"""Rita Realtime Voice Engine v3 production worker.

Daily WebRTC -> Soniox stt-rt-v5 -> Smart Turn v3 ->
Groq openai/gpt-oss-120b -> Cartesia Sonic 3.6 TTS -> Daily WebRTC.

No legacy provider is configured. Provider failures surface as real errors so
an incomplete experiment can never be mistaken for the approved architecture.
"""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.observers.loggers.metrics_log_observer import MetricsLogObserver
from pipecat.observers.startup_timing_observer import StartupTimingObserver
from pipecat.observers.user_bot_latency_observer import UserBotLatencyObserver
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMAssistantAggregatorParams,
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import DailyRunnerArguments
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.soniox.stt import (
    SonioxContextGeneralItem,
    SonioxContextObject,
    SonioxSTTService,
)
from pipecat.transcriptions.language import Language
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.utils.context.llm_context_summarization import (
    LLMAutoContextSummarizationConfig,
    LLMContextSummaryConfig,
)

from rita_cartesia_tts import RitaCartesiaTTSService
from rita_dialect import DIALECT_PROMPT, RitaSpeechCleaner
from rita_interruption import RitaUserTurnStartStrategy, gate_mode
from rita_groq_llm import RitaGroqLLMService
from rita_latency import RitaLatencyObserver, RitaLatencyRecorder
from rita_state import ResponseType, RitaSessionState
from rita_target_language import (
    parse_target_language,
    stt_language_codes,
    target_language_prompt,
)
from rita_turn_policy import (
    RitaBoundedTurnStopStrategy,
    bounded_commit_secs,
    period_commit_secs,
    unpunctuated_commit_secs,
)
from rita_turn_router import RitaTurnRouter, RouterMode, router_mode
from rita_word_joiner import RitaWordJoiner

load_dotenv(override=False)

STT_MODEL = "stt-rt-v5"
LLM_MODEL = "openai/gpt-oss-120b"
# The reply and the model's short reasoning share this budget. Keep enough headroom
# for reasoning without encouraging the tutor to continue offering examples after
# the learner's question has already been answered.
LLM_MAX_COMPLETION_TOKENS = int(os.getenv("RITA_LLM_MAX_COMPLETION_TOKENS", "450"))
# An explanation ("اشرح", "فصّلي كل كلمة") shares its budget with the model's thinking, and 450 cut
# the longest ones off. Quick answers keep the small budget and low effort.
LLM_EXPLAIN_MAX_COMPLETION_TOKENS = int(os.getenv("RITA_LLM_EXPLAIN_MAX_COMPLETION_TOKENS", "800"))
LLM_EXPLAIN_REASONING_EFFORT = os.getenv("RITA_LLM_EXPLAIN_REASONING_EFFORT", "medium")
TTS_PROVIDER = os.getenv("RITA_TTS_PROVIDER", "cartesia").strip().casefold()
TTS_MODEL = "sonic-3.6"
# Layan is the explicitly selected Cartesia library voice. Voice IDs are not
# credentials; the Cartesia API key remains only in Modal's secret store.
TTS_VOICE_ID = os.getenv(
    "RITA_CARTESIA_VOICE_ID", "64a941ac-07ac-462c-a81c-008e353dd83e"
).strip()


# A zero delay makes Cartesia eligible to synthesize every tiny streamed fragment
# immediately.  With Groq token streaming that sounded like separated syllables on
# real iPads.  A small managed buffer keeps whole words together while preserving
# sub-sentence streaming and interruption.
def _cartesia_buffer_delay_ms() -> int:
    """Return a production-safe Cartesia buffer even with a stale Modal secret."""

    try:
        configured = int(os.getenv("RITA_CARTESIA_MAX_BUFFER_DELAY_MS", "50"))
    except ValueError:
        configured = 50
    # Zero reproduced syllable-sized playback. Keep production tuning intentionally
    # narrow so a stale Modal value cannot silently restore that regression.
    return min(200, max(50, configured))


TTS_MAX_BUFFER_DELAY_MS = _cartesia_buffer_delay_ms()
TTS_TRIM_LEADING_SILENCE = os.getenv(
    # Enabled for every production session after the Arabic/German/English
    # safety corpus and Soniox first-token checks passed. Operators retain an
    # immediate kill switch by setting the variable explicitly to `false`.
    "RITA_CARTESIA_TRIM_ENABLED", "true"
).strip().casefold() in {"1", "true", "yes", "on"}
TTS_TRIM_RMS_FLOOR = float(os.getenv("RITA_CARTESIA_TRIM_RMS_FLOOR", "32"))
TTS_TRIM_PEAK_FLOOR = int(os.getenv("RITA_CARTESIA_TRIM_PEAK_FLOOR", "128"))
SONIOX_URL = os.getenv(
    "SONIOX_URL", "wss://stt-rt.eu.soniox.com/transcribe-websocket"
).strip()

PERSONALITIES = {
    "kind": "Warm, patient, encouraging, and never patronizing.",
    "direct": "Clear, concise, honest, and free of sugar-coating.",
    "playful": "Light, clever, encouraging, and still accurate.",
    "strict": "Focused, structured, respectful, and demanding in a helpful way.",
}


def require_secret(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Required secret {name} is missing")
    return value


def lesson_terms(body: dict[str, Any]) -> list[str]:
    raw = body.get("lessonTerms", [])
    if not isinstance(raw, list):
        return []
    cleaned = [str(term).strip()[:80] for term in raw if str(term).strip()]
    return cleaned[:40]


def lesson_section(body: dict[str, Any]) -> str:
    """Curriculum lesson notes sent by the website, or an empty string."""
    lesson = body.get("lesson")
    if not isinstance(lesson, dict):
        return ""
    brief = str(lesson.get("brief") or "").strip()[:4000]
    if not brief:
        return ""
    return f"""
CURRICULUM LESSON
You are teaching this lesson now. The notes are for you only; never read them aloud.
{brief}
How to run it:
- On the learner's first turn, greet them briefly, name today's topic in one sentence, then start.
- Follow the plan in order. Teach one small point, give one example, then ask the learner to say
  their own sentence. Keep the learner talking more than you.
- Work through the objectives one at a time. For each one, ask one of its questions and wait.
- The website checks the objectives from what the learner says; never announce scores or stars.
- If an answer has a mistake, model the correct sentence once and ask them to try again.
- Stay on this lesson. If the learner drifts, answer in one sentence and bring them back.
- When every objective has been practised, praise the learner and wrap up in two sentences.
"""


def explain_options(state: RitaSessionState) -> dict[str, Any] | None:
    """A larger reply budget and more thinking for an explanation turn; None for everything else."""

    if state.response_type != ResponseType.EXPLAIN:
        return None
    return {
        "max_completion_tokens": LLM_EXPLAIN_MAX_COMPLETION_TOKENS,
        "reasoning_effort": LLM_EXPLAIN_REASONING_EFFORT,
    }


def build_prompt(body: dict[str, Any], state: RitaSessionState, *, dialogue: bool = False) -> str:
    personality = str(body.get("personality", "kind"))
    profile_language = str(body.get("language", "automatic"))
    remembered_dialect = str(body.get("dialect", "ar-JO"))
    mode = str(body.get("mode", "free_conversation"))
    target = parse_target_language(body)
    target_block = target_language_prompt(target)
    note = state.turn_note(dialogue=dialogue)
    turn_note = f"{note}\n" if note else ""
    return f"""You are Rita, RitaJet's realtime language tutor.

Delivery: {PERSONALITIES.get(personality, PERSONALITIES['kind'])}
Profile language: {profile_language}. Stable Arabic dialect: {remembered_dialect}.
Lesson mode: {mode}.{target_block}

PRIORITY WHEN RULES CLASH
1) Honesty and safety. 2) The REPLY LANGUAGE on the last line. 3) What the learner asked this turn
(a TURN NOTE or directive in the session state). 4) The style rules below.

CONVERSATION CONTINUITY
- Saved messages from an earlier call may appear after this system message. Treat only those messages as
  prior context. Continue naturally without greeting again or claiming to remember anything not shown.
- The saved history is deliberately bounded. If an older detail is missing, ask instead of inventing it.

VOICE CONTRACT
- Speak for the ear, never for a page. Start with the useful answer; never restate the question.
- Default to one or two short spoken sentences (a TURN NOTE may allow more). Give one teaching correction
  at a time.
- Put a natural full stop after the first short, meaningful clause so streaming TTS can begin early.
- No markdown, lists, numbering, headings, JSON, code fences, URLs, citations, or stage directions in
  speech. To give several items, say them in one flowing sentence.
- Speak only to the learner. Never read internal metadata or tool data aloud, never write notes to
  yourself, and never write the words "user", "learner_act", "directive" or any session-state field name.

LANGUAGE AND DIALECT
- Write in the REPLY LANGUAGE named on the last line. Arabic defaults to friendly Jordanian Arabic
  (شو، بدي، عليك، مش); do not drift to Iraqi شنو, Gulf, Egyptian, or formal Arabic unless asked.
- One German or English word inside Arabic is code-switching, not a language change. Pronounce German
  and English target words naturally inside Arabic sentences.

{DIALECT_PROMPT}
TEACHING CONTROL
- If the learner says they understand or says move on, do not repeat the previous explanation.
- Once the question is answered, stop. Do not volunteer more examples or ask whether they want
  another example unless the learner explicitly asks for more.
- A short acknowledgement such as آه، أوكي، تمام، شكراً, or got it does not need a new lesson.
  Reply with at most one brief acknowledgement, then wait.
- If the same correction fails twice (attempt_count two or more), change strategy: slower example, minimal
  pair, syllable isolation, or a different analogy. Never repeat last_feedback.
- You receive a text transcript, not the learner's acoustic signal. Never praise, score, or correct
  pronunciation from transcript spelling alone. In an explicit pronunciation drill, state that limitation
  and correct only an issue supported by actual audio evidence supplied by the system.
- Never mention a letter, sound, word, or meaning that is absent from the learner's exact target.
  Preserve the exact concept they asked about; if it is ambiguous, ask one short clarification.
- Grammar facts must be true. German prepositions do not all take the dative: mit, nach, bei, seit, von,
  zu, aus take the dative; für, durch, gegen, ohne, um the accusative; an, auf, in, über, unter, vor,
  zwischen, neben, hinter either (dative = where, accusative = where to). hoffen takes auf + accusative.
  If you are not sure of a rule, say so briefly instead of stating it.
- Never turn a general-knowledge answer into vocabulary or flashcards.
- Never claim Flashcards or German Lab were saved; the website confirms only after a real transaction.
- If unsure what was heard, ask one short clarification in the same language.

TURN-TAKING AND SHORT REPLIES
- The session state may carry learner_act and a directive about the learner's last short turn. Follow it.
- Stop words (خلص، خلاص، كفاية، وقف، وقفي، enough, stop) mean stop talking. They never mean "summarize"
  or "finish the topic". Do not repeat or restart the explanation after them.
- Thinking sounds (أمم، يعني، استنى، لحظة، um) are not requests. Never answer them.
- Read a short answer against last_question and options. After a question that offered options, a bare
  إيه or نعم is not a choice: ask "أي واحد: A ولا B؟" and nothing more.
- For "مش عارف", choose the simplest option yourself in one short sentence and continue.
- For "لا قصدي" or "مش هيك", drop your last assumption and say in one sentence what you understood now.
- Never return to anything listed in rejected interpretations unless the learner explicitly restores it.
- For a complaint, briefly acknowledge it. Never invent a technical cause, defend yourself, or teach.
- To simplify, keep the exact concept and use one concrete example. If asked again, change method.
- Ask at most one question per reply, and never two questions joined by "أو" or "ولا" (two options
  inside one question are fine). Never explain a word or phrase the learner did not ask about.
- General-knowledge questions: at most two short sentences, then stop.

HUMAN TONE
- Sound like a warm friend who is also a good teacher, not like an assistant reading a script.
- React first, teach second: one small natural reaction ("آه فهمت"، "حلو"، "أكيد"), then the point.
  Vary your openers; never start two replies the same way, and do not keep saying "ممتاز" or "رائع".
- Match the learner's energy: calm when they sound tired or stuck, light when they are playful. If they
  are discouraged, say one human sentence about it first ("عادي، هاي صعبة عند الكل").
- When you misunderstood, say so plainly ("آسفة، فهمتك غلط") and move on.
- Use natural spoken Jordanian (هلأ، هيك، بدك، طيب) lightly. Short sentences with one idea each.
- Praise only what is really good, and say what. Never lecture.
- Do not guess the learner's gender: no commands or adjectives aimed at them that change with gender
  (like خدي/خد, جاهز/جاهزة); use neutral wording such as "خلّينا نكمل" and "لما يناسبك".
{lesson_section(body)}
SESSION STATE (changes every turn; read it last)
Structured session state: {state.prompt_state(dialogue=dialogue)}.
{turn_note}{state.reply_language_line(target["name"] if target else None)}
"""


def saved_conversation_history(body: dict[str, Any]) -> list[dict[str, str]]:
    """Return a small, untrusted transcript tail safe for the realtime context."""
    raw = body.get("conversationHistory")
    if not isinstance(raw, list):
        return []
    selected_newest_first: list[dict[str, str]] = []
    characters = 0
    # Budget from newest to oldest so a long conversation never pushes the
    # immediately preceding turn out of Rita's active context.
    for item in reversed(raw[-24:]):
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", ""))
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content", "")).strip()[:4000]
        if not content:
            continue
        remaining = 12000 - characters
        if remaining <= 0:
            break
        content = content[:remaining]
        selected_newest_first.append({"role": role, "content": content})
        characters += len(content)
    return list(reversed(selected_newest_first))


async def bot(args: DailyRunnerArguments):
    """Pipecat Cloud entrypoint; the Modal worker calls run_bot directly."""
    await run_bot(
        room_url=args.room_url,
        token=args.token,
        session_id=args.session_id,
        body=args.body if isinstance(args.body, dict) else {},
    )


def stt_language_hints(body: dict[str, Any]) -> list[Language]:
    """Speech-recognition hints for this session: Arabic, the learner's target language, English."""
    hints: list[Language] = []
    for code in stt_language_codes(parse_target_language(body)):
        try:
            hint = Language(code)
        except ValueError:
            continue  # a language the recogniser does not know is simply not hinted
        if hint not in hints:
            hints.append(hint)
    return hints or [Language.AR, Language.DE, Language.EN]


async def run_bot(*, room_url: str, token: str, session_id: str, body: dict[str, Any]):
    if TTS_PROVIDER != "cartesia":
        raise RuntimeError("Rita v3 production is configured only for Cartesia TTS")
    if not TTS_VOICE_ID:
        raise RuntimeError("Required Cartesia voice ID is missing")
    latency = RitaLatencyRecorder(session_id, str(body.get("traceId") or ""))
    latency.session_mark("worker_session_started")
    state = RitaSessionState(
        active_language=str(body.get("language", "automatic")),
        active_dialect=str(body.get("dialect", "ar-JO")),
    )
    logger.bind(session_id=session_id).info("Starting Rita v3 session")
    router_state = router_mode()
    logger.bind(router=router_state.value, interrupt_gate=gate_mode()).info(
        "Rita turn-taking configuration"
    )

    transport = DailyTransport(
        room_url,
        token,
        "Rita",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_in_enabled=False,
        ),
    )
    latency.session_mark("daily_transport_created")

    stt = SonioxSTTService(
        api_key=require_secret("SONIOX_API_KEY"),
        url=SONIOX_URL,
        vad_force_turn_endpoint=True,
        settings=SonioxSTTService.Settings(
            model=STT_MODEL,
            language_hints=stt_language_hints(body),
            language_hints_strict=False,
            enable_language_identification=True,
            enable_speaker_diarization=False,
            context=SonioxContextObject(
                general=[
                    SonioxContextGeneralItem(key="product", value="RitaJet language tutor"),
                    SonioxContextGeneralItem(key="dialect", value="Jordanian Arabic ar-JO"),
                    SonioxContextGeneralItem(
                        key="mode", value=str(body.get("mode", "free_conversation"))
                    ),
                    SonioxContextGeneralItem(
                        key="speech",
                        value="Jordanian Arabic with frequent short commands and English or German "
                        "words, sometimes written in Arabic letters",
                    ),
                ],
                terms=[
                    "RitaJet",
                    "German Lab",
                    "Flashcards",
                    "Guten Morgen",
                    # Short commands and answers that must be heard exactly.
                    "خلص",
                    "وقفي",
                    "كفاية",
                    "استنى",
                    "لحظة",
                    "أمم",
                    "نوب",
                    "أوكي",
                    "ستوب",
                    "مش عارف",
                    "قصدي",
                    *lesson_terms(body),
                ],
            ),
        ),
    )

    llm = RitaGroqLLMService(
        api_key=require_secret("GROQ_API_KEY"),
        latency_recorder=latency,
        turn_options=lambda: explain_options(state),
        settings=GroqLLMService.Settings(
            model=LLM_MODEL,
            temperature=0.45,
            top_p=0.9,
            max_completion_tokens=LLM_MAX_COMPLETION_TOKENS,
            extra={"reasoning_effort": "low"},
        ),
    )

    tts = RitaCartesiaTTSService(
        api_key=require_secret("CARTESIA_API_KEY"),
        voice_id=TTS_VOICE_ID,
        latency_recorder=latency,
        max_buffer_delay_ms=TTS_MAX_BUFFER_DELAY_MS,
        trim_leading_silence=TTS_TRIM_LEADING_SILENCE
        or body.get("trimLeadingSilence") is True,
        trim_rms_floor=TTS_TRIM_RMS_FLOOR,
        trim_peak_floor=TTS_TRIM_PEAK_FLOOR,
    )

    saved_history = saved_conversation_history(body)
    initial_messages = [
        {
            "role": "system",
            "content": build_prompt(body, state, dialogue=router_state == RouterMode.ON),
        },
        *saved_history,
    ]
    if not saved_history:
        initial_messages.append(
            {"role": "assistant", "content": "Hi, I’m Rita. What would you like to practise?"}
        )
    context = LLMContext(initial_messages)
    vad = SileroVADAnalyzer(params=VADParams(stop_secs=0.2))
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            user_turn_strategies=UserTurnStrategies(
                start=[RitaUserTurnStartStrategy()],
                stop=[
                    RitaBoundedTurnStopStrategy(
                        turn_analyzer=LocalSmartTurnAnalyzerV3(),
                        bounded_secs=bounded_commit_secs(body),
                        unpunctuated_secs=unpunctuated_commit_secs(body),
                        period_secs=period_commit_secs(body),
                    )
                ]
            ),
            user_turn_stop_timeout=1.5,
            vad_analyzer=vad,
        ),
        assistant_params=LLMAssistantAggregatorParams(
            enable_auto_context_summarization=True,
            auto_context_summarization_config=LLMAutoContextSummarizationConfig(
                max_context_tokens=8_000,
                max_unsummarized_messages=24,
                summary_config=LLMContextSummaryConfig(
                    target_context_tokens=1_500,
                    min_messages_after_summary=10,
                    summarization_prompt=(
                        "Summarize: the topic being discussed right now, the last question the tutor "
                        "asked with its options word for word, what the learner wants next, the stable "
                        "language/dialect, words taught, confirmed understanding, unresolved "
                        "correction, and tool results."
                    ),
                    llm=llm,
                ),
            ),
        ),
    )

    def turn_language() -> str:
        # In automatic mode the prompt replies in the current turn language before a
        # language becomes stable, so TTS must make the same choice.
        return (
            state.active_language
            if state.active_language in {"ar", "de", "en"}
            else state.current_turn_language
        )

    def prepare_turn(text: str) -> None:
        """Update the session state, the TTS language and the system prompt for one turn."""
        state.observe_user_turn(text)
        tts.set_turn_language(turn_language())
        # One line per learner turn, never the words themselves: lets a Modal log show why a
        # language was locked, what the turn was read as, and how long the learner's turn was.
        logger.bind(
            language=state.active_language,
            language_source=state.language_source.value,
            turn_language=state.current_turn_language,
            act=state.last_act.value,
            response_type=state.response_type.value,
            words=len(text.split()),
            how_to_say=state.asked_how_to_say,
        ).info("Rita learner turn")
        messages = context.get_messages()
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = build_prompt(
                body, state, dialogue=router_state == RouterMode.ON
            )

    router = RitaTurnRouter(
        state=state,
        prepare_turn=prepare_turn,
        language_of_turn=lambda: turn_language() if turn_language() in {"ar", "de", "en"} else "ar",
        mode=router_state,
        session_id=session_id,
        trace_id=latency.trace_id,
        turn_id=lambda: latency.turn,
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            router,
            llm,
            RitaWordJoiner(),
            RitaSpeechCleaner(),
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )
    startup_observer = StartupTimingObserver()
    user_bot_observer = UserBotLatencyObserver()

    @startup_observer.event_handler("on_startup_timing_report")
    async def on_startup_timing_report(observer, report):
        logger.bind(
            session_id=session_id,
            total_ms=round(report.total_duration_secs * 1000, 2),
            processors=[
                {"name": item.processor_name, "duration_ms": round(item.duration_secs * 1000, 2)}
                for item in report.processor_timings
            ],
        ).info("Rita worker startup timing")

    @startup_observer.event_handler("on_transport_timing_report")
    async def on_transport_timing_report(observer, report):
        logger.bind(
            session_id=session_id,
            bot_connected_ms=(
                round(report.bot_connected_secs * 1000, 2)
                if report.bot_connected_secs is not None
                else None
            ),
            client_connected_ms=round(report.client_connected_secs * 1000, 2),
        ).info("Rita transport timing")

    @user_bot_observer.event_handler("on_latency_measured")
    async def on_user_bot_latency(observer, latency_seconds):
        logger.bind(
            session_id=session_id,
            turn_id=latency.turn,
            latency_ms=round(latency_seconds * 1000, 2),
        ).info("Rita user-to-bot speaking signal latency")

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
            audio_in_sample_rate=16_000,
            audio_out_sample_rate=24_000,
        ),
        enable_turn_tracking=True,
        observers=[
            RitaLatencyObserver(latency),
            MetricsLogObserver(),
            startup_observer,
            user_bot_observer,
        ],
    )

    @task.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, msg):
        # The learner's "Stop Rita" button: a sure way to interrupt that does not depend on
        # the microphone, the noise around them or what the speech recognizer heard.
        if getattr(msg, "type", "") == "rita-learning-count":
            # How many words the learner has in the list on screen ("open the list" needs it).
            try:
                count = int((getattr(msg, "data", None) or {}).get("count"))
                state.learning_count = max(0, min(count, 1000))
            except (TypeError, ValueError, AttributeError):
                state.learning_count = None
            return
        if getattr(msg, "type", "") == "rita-stop":
            logger.info("Rita stopped by the learner's button")
            state.topic_paused = True
            await rtvi.interrupt_bot()

    @user_aggregator.event_handler("on_user_turn_stopped")
    async def on_user_turn_stopped(aggregator, strategy, message):
        latency.mark("turn_committed")
        # No strategy means the controller's inactivity timer ended the turn.
        stop_reason = (
            getattr(strategy, "last_stop_reason", None)
            if strategy is not None
            else "long_incomplete_timeout"
        )
        latency.session_mark("turn_stop_reason", stop_reason=stop_reason)
        if router_state != RouterMode.ON:
            # With the router on, it prepares the turn itself before the model reads it.
            prepare_turn(message.content)
        logger.bind(
            session_id=session_id,
            trace_id=latency.trace_id or None,
            turn_id=latency.turn,
            stop_reason=stop_reason,
            word_count=len(message.content.split()),
            character_count=len(message.content),
            response_type=state.response_type,
            language=state.active_language,
            dialect=state.active_dialect,
        ).info("Rita user turn committed")

    @assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message):
        state.observe_assistant_turn(message.content)
        logger.bind(
            session_id=session_id,
            trace_id=latency.trace_id or None,
            turn_id=latency.turn,
            spoken_characters=len(message.content),
            interrupted=False,
        ).info("Rita assistant turn committed")

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        latency.session_mark("daily_participant_joined")
        await transport.capture_participant_audio(participant["id"], sample_rate=16_000)
        latency.session_mark("daily_audio_capture_started")

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()

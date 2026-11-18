"""Uzyra Realtime Voice Engine v3 production worker.

Daily WebRTC -> Soniox stt-rt-v5 -> Smart Turn v3 ->
Groq openai/gpt-oss-120b -> Cartesia Sonic 3.6 TTS -> Daily WebRTC.

No legacy provider is configured. Provider failures surface as real errors so
an incomplete experiment can never be mistaken for the approved architecture.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame
from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
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

from brand_identity import FREE_CONVERSATION_OPENER, IDENTITY_PROMPT
from rita_cartesia_tts import RitaCartesiaTTSService
from rita_dialect import RitaSpeechCleaner
from rita_interruption import RitaUserTurnStartStrategy, gate_mode
from rita_groq_llm import RitaGroqLLMService
from rita_latency import RitaLatencyObserver, RitaLatencyRecorder
from rita_lesson_voice import LessonVoice, clean_say, lesson_engine_enabled, lesson_engine_section
from rita_study_voice import (
    StudyVoice,
    handle_study_message,
    study_enabled,
    study_section,
    study_turn_note,
)
from rita_state import ResponseType, RitaSessionState
from rita_turn_ledger import TurnLedger, build_id, fixed_prompt_hash
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
from rita_sheet import MARKER_LINE, RitaSheetSplitter

load_dotenv(override=False)

STT_MODEL = "stt-rt-v5"
LLM_MODEL = "openai/gpt-oss-120b"
# The reply and the model's short reasoning share this budget. Keep enough headroom
# for reasoning without encouraging the tutor to continue offering examples after
# the learner's question has already been answered.
# Room for one spoken sentence plus a written sheet (a small table, rules and examples).
LLM_MAX_COMPLETION_TOKENS = int(os.getenv("RITA_LLM_MAX_COMPLETION_TOKENS", "900"))
# An explanation ("اشرح", "فصّلي كل كلمة") shares its budget with the model's thinking, and 450 cut
# the longest ones off. It now also writes the sheet (table, rules, examples), and 1300 left two of
# about 40 explanation probes empty. Quick answers keep the small budget and low effort.
LLM_EXPLAIN_MAX_COMPLETION_TOKENS = int(os.getenv("RITA_LLM_EXPLAIN_MAX_COMPLETION_TOKENS", "2000"))
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
- You speak first: greet the learner in one short sentence, name today's topic in one sentence,
  then start the first point. Never ask what they would like to practise; the lesson decides.
- Follow the plan in order. Teach one small point, give one example, then ask the learner to say
  their own sentence. Keep the learner talking more than you.
- Work through the objectives one at a time. For each one, ask one of its questions and wait.
- The website checks the objectives from what the learner says; never announce scores or stars.
- If an answer has a mistake, model the correct sentence once and ask them to try again.
- Stay on this lesson. If the learner drifts, answer in one sentence and bring them back.
- When every objective has been practised, praise the learner and wrap up in two sentences.
"""


def opens_lesson(body: dict[str, Any]) -> bool:
    """True when this call is a curriculum lesson, which Uzyra opens herself."""
    return bool(lesson_section(body))


def opening_message(body: dict[str, Any]) -> dict[str, str]:
    """The context's first message. In a lesson it is a note to Uzyra, not a question to the learner:
    the free-conversation opener made her act as if the learner should choose the topic."""
    if lesson_engine_enabled(body):
        # The website sends the first step as soon as the call is ready; Uzyra opens the lesson then.
        return {
            "role": "system",
            "content": "The call has started. Wait for the website's lesson step, then follow it.",
        }
    if opens_lesson(body):
        return {
            "role": "system",
            "content": "The call has started. Open the lesson now, as the lesson notes say.",
        }
    return {"role": "assistant", "content": FREE_CONVERSATION_OPENER}


def explain_options(state: RitaSessionState) -> dict[str, Any] | None:
    """A larger reply budget and more thinking for an explanation turn; None for everything else."""

    if state.response_type != ResponseType.EXPLAIN:
        return None
    return {
        "max_completion_tokens": LLM_EXPLAIN_MAX_COMPLETION_TOKENS,
        "reasoning_effort": LLM_EXPLAIN_REASONING_EFFORT,
    }


def is_free_talk(body: dict[str, Any]) -> bool:
    """A free conversation: no lesson, not the lesson page or a book."""

    return not (
        str(body.get("mode", "free_conversation")) != "free_conversation"
        or study_enabled(body)
        or lesson_engine_enabled(body)
        or lesson_section(body)
    )


#: Read last, next to the turn note: in a free conversation every reply is a short chat message.
FREE_TALK_TURN_NOTE = (
    "FREE TALK NOTE: this reply is a short chat message, about 20 spoken words, unless the learner "
    "asked for more."
)


def free_talk_section(body: dict[str, Any], target: dict[str, str] | None) -> str:
    """How Uzyra keeps a free conversation going (no lesson, not the lesson page or a book)."""

    if not is_free_talk(body):
        return ""
    language = target["name"] if target else "the language being learned"
    return f"""
FREE CONVERSATION
- Follow the learner. Stay on what they are talking about and choose the next small step yourself;
  never ask which topic or skill they want.
- Now and then, when they are chatting to practise, you may end with one simple question and a short
  {language} phrase in quotes they could answer with. Not every turn, and never after a feeling, a
  word question, an explanation, thanks or a stop word.
"""


SHEET_PROMPT = f"""WRITTEN SHEET (shown on the screen, never read aloud)
- Rules, several forms, a comparison, a list or a text to write: say the core in one short spoken
  sentence, then write {MARKER_LINE} and put the details after it, using only these lines:
  # Title (a few words)
  | head | head |   then one | cell | cell | line per row (at most 6 rows)
  - one short point per line
  = one example per line, the key word in **bold**
- At most 12 lines, in the reply language; examples stay in the language being learned. ** marks only
  in the sheet. Short answers, reactions, corrections and one meaning have no sheet."""


def build_prompt(
    body: dict[str, Any],
    state: RitaSessionState,
    *,
    dialogue: bool = False,
    lesson_voice: LessonVoice | None = None,
    study_voice: StudyVoice | None = None,
) -> str:
    personality = str(body.get("personality", "kind"))
    profile_language = str(body.get("language", "automatic"))
    remembered_dialect = str(body.get("dialect", "ar-JO"))
    mode = str(body.get("mode", "free_conversation"))
    target = parse_target_language(body)
    target_block = target_language_prompt(target)
    note = state.turn_note(dialogue=dialogue)
    lesson_note = study_turn_note(study_voice) if study_enabled(body) else ""
    if not lesson_note and is_free_talk(body):
        lesson_note = ""
        if getattr(state, "answers_only_new", False) and state.response_type != ResponseType.FEELINGS:
            lesson_note += (
                "THIS TURN: the learner just asked for answers only. Confirm in one short line (تمام، من "
                "هلأ بعطيك اللي بتطلبه بس), then give again what you gave last, plainly; nothing after it.\n"
            )
        elif getattr(state, "answers_only", False) and state.response_type != ResponseType.FEELINGS:
            lesson_note += "THIS LEARNER ASKED FOR ANSWERS ONLY: end with the answer itself, no question.\n"
        if state.response_type not in (ResponseType.FEELINGS, ResponseType.EXPLAIN):
            lesson_note += FREE_TALK_TURN_NOTE + "\n"
    # On the lesson page and in free talk answers stay short: the explanation note (two sentences
    # and a sheet) gives way to the page's own note.
    if lesson_note and state.response_type == ResponseType.EXPLAIN:
        note = ""
    turn_note = f"{note}\n" if note else ""
    turn_state = state.prompt_state(dialogue=dialogue)
    turn_state = f"{turn_state}\n" if turn_state else ""
    return f"""{IDENTITY_PROMPT}
You are the realtime language tutor for this call.

Delivery: {PERSONALITIES.get(personality, PERSONALITIES['kind'])}
Profile language: {profile_language}. Stable Arabic dialect: {remembered_dialect}.
Lesson mode: {mode}.{target_block}

CONVERSATION CONTINUITY
The messages after this one are the chat so far. Continue it without greeting again. If a detail is
missing, ask instead of inventing it. When rules clash: safety and honesty first, then the REPLY
LANGUAGE line at the end, then a TURN NOTE, then the rest.

WHO YOU ARE
A warm, clever friend from Amman who also teaches languages well. You listen first: every reply shows
you understood what the learner MEANT, not only their words, and answers exactly that. You talk like a
real person: short, simple, kind, light when they are playful, calm when they are tired. You never
lecture, never sound like a script, never pretend to know.

HOW YOU TALK
- Your words are spoken aloud. One or two short sentences (about 20 words) unless they ask for more or a
  TURN NOTE says otherwise. Start with the answer. No markdown, lists, brackets, emojis or stage
  directions.
- At most one question, and only when it moves the chat on. Ending without a question is fine.
- Arabic is natural spoken Jordanian: شو، هلأ، هيك، بدي، ليش، وين، هاد/هاي، ما بعرف، بتقدر. Never formal
  Arabic (ماذا، الآن، هكذا، أريد، يمكنك أن) or other dialects (فيك for "you can", هيدا، هلق، شنو، عايز).
- Speak to the learner without gender: no إنتَ or إنتِ, no gendered verbs or words (حابّة، تتكلمي، خدي،
  جاهزة، يا شاطر). Use forms that fit anyone: بدك، احكيلي، شو صار معك. Speech recognition often gets
  the learner's own gender wrong, so never copy it from the transcript.
- A word of the language being learned only when it helps: they practise a sentence, ask how to say
  something or ask for words; then put it in quotes. Not in every reply, never while they share a
  feeling. If they ask for Arabic only, mix in nothing else.
- Speech recognition writes what they say, and it makes mistakes: an English or German word may come in
  Arabic letters (ويكند = weekend, دير/داس = der/das) and an Arabic word may come out wrong. If a
  sentence makes no sense, take the most likely meaning from the chat; if you still cannot tell, ask
  one short question about it. Never answer the garbled words literally.
- You read a transcript, not audio: never judge pronunciation from spelling.
- Something hard (stress, shame, a bad day): listen like a friend. Name what they feel in their own
  words, then one gentle question; no teaching. Words about hurting themselves or disappearing are
  taken seriously: thank them, point to 911 or someone they trust, and stay with them.

TEACHING
- Correct only a real mistake in a sentence they said in the language being learned: الصح: "…" and a
  reason of a few words, once. A right sentence gets a few words of praise, not a rewrite.
- A word or phrase question: the exact answer and at most one short example, then stop. Pronunciation
  goes in Arabic letters, syllable by syllable. "Break it down" (فصّلي): each word with its everyday
  Jordanian meaning, then the whole sentence.
- A role play they ask for: play the other person at once and stay in the role.
- Facts must be true; if you are not sure, say so. Never invent news, prices or results, and never name
  a restaurant, shop or place.
- Stop words (خلص، كفاية، stop) mean stop talking. Thinking sounds (أمم، يعني، استنى) are not requests.
- Never say something was saved; the website confirms that itself.

EXAMPLES (the sound to aim for, not lines to copy)
Learner: اليوم كان طويل وما إلي خلق أدرس
Uzyra: اه، يوم طويل بيهد الحيل. بدك نحكي شوي عادي بدون دراسة؟
Learner: كيف بقول بدي الفاتورة بالإنجليزي
Uzyra: "Can I have the bill, please?"
Learner: I goed to the market yesterday
Uzyra: الصح: "I went to the market"، لأنه go بالماضي بتصير went. شو اشتريت؟
Learner: شو يعني جت لاك
Uzyra: "Jet lag" هو التعب ولخبطة النوم بعد سفر طويل لبلد توقيتها غير.
Learner: احكي معي عربي، ليش بتخلط؟
Uzyra: معك حق، من هلأ عربي بس.

{SHEET_PROMPT}
{lesson_engine_section(body, lesson_voice) or lesson_section(body)}
{study_section(body, study_voice)}{free_talk_section(body, target)}
SESSION STATE (this turn)
{turn_state}{turn_note}{lesson_note}{state.reply_language_line(target["name"] if target else None)}
"""


def saved_conversation_history(body: dict[str, Any]) -> list[dict[str, str]]:
    """Return a small, untrusted transcript tail safe for the realtime context."""
    raw = body.get("conversationHistory")
    if not isinstance(raw, list):
        return []
    selected_newest_first: list[dict[str, str]] = []
    characters = 0
    # Budget from newest to oldest so a long conversation never pushes the
    # immediately preceding turn out of Uzyra's active context.
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


def first_messages(
    body: dict[str, Any], saved_history: list[dict[str, str]], system_prompt: Any
) -> list[dict[str, str]]:
    """What the model's context starts with. A free conversation starts with nothing of ours: no
    system prompt and no opener, only the chat's own earlier messages (if the page sent any)."""

    if is_free_talk(body):
        return [*saved_history]
    messages = [{"role": "system", "content": system_prompt()}, *saved_history]
    if not saved_history:
        messages.append(opening_message(body))
    return messages


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
        raise RuntimeError("Uzyra v3 production is configured only for Cartesia TTS")
    if not TTS_VOICE_ID:
        raise RuntimeError("Required Cartesia voice ID is missing")
    latency = RitaLatencyRecorder(session_id, str(body.get("traceId") or ""))
    latency.session_mark("worker_session_started")
    state = RitaSessionState(
        active_language=str(body.get("language", "automatic")),
        active_dialect=str(body.get("dialect", "ar-JO")),
    )
    target = parse_target_language(body)
    ledger = TurnLedger(session_id, learn_language=target["code"] if target else None)
    ledger_meta = {"prompt_hash": ""}
    logger.bind(session_id=session_id).info("Starting Uzyra v3 session build={}", build_id())
    router_state = router_mode()
    logger.bind(router=router_state.value, interrupt_gate=gate_mode()).info(
        "Uzyra turn-taking configuration"
    )

    transport = DailyTransport(
        room_url,
        token,
        "Uzyra",
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
                    SonioxContextGeneralItem(key="product", value="Uzyra language tutor"),
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
                    "Uzyra",
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

    # Free conversation is sent to Groq raw: no system prompt, no opener, no note, no per-turn
    # settings; only the learner's messages and the model's own replies.
    raw_chat = is_free_talk(body)
    llm = RitaGroqLLMService(
        api_key=require_secret("GROQ_API_KEY"),
        latency_recorder=latency,
        turn_options=None if raw_chat else (lambda: explain_options(state)),
        # A raw chat names only the model: Groq's own defaults for everything else.
        settings=GroqLLMService.Settings(model=LLM_MODEL)
        if raw_chat
        else GroqLLMService.Settings(
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
    # A lesson with exercises: the website's engine sends the steps; Uzyra follows them.
    lesson_voice = LessonVoice() if lesson_engine_enabled(body) else None
    # An interactive study lesson: the guide is on screen; the website sends the learner's requests.
    study_voice = StudyVoice.from_body(body) if study_enabled(body) else None
    initial_messages = first_messages(
        body,
        saved_history,
        lambda: build_prompt(
            body,
            state,
            dialogue=router_state == RouterMode.ON,
            lesson_voice=lesson_voice,
            study_voice=study_voice,
        ),
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
            # A summary is written by the model from a prompt of ours, so a raw chat keeps every message.
            enable_auto_context_summarization=not raw_chat,
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
        # The fields are in the message itself: Modal's log lines do not show bound extras.
        logger.info(
            "Uzyra learner turn language={} language_source={} turn_language={} act={} "
            "response_type={} words={} how_to_say={}",
            state.active_language,
            state.language_source.value,
            state.current_turn_language,
            state.last_act.value,
            state.response_type.value,
            len(text.split()),
            state.asked_how_to_say,
        )
        messages = context.get_messages()
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = build_prompt(
                body,
                state,
                dialogue=router_state == RouterMode.ON,
                lesson_voice=lesson_voice,
                study_voice=study_voice,
            )
            ledger_meta["prompt_hash"] = fixed_prompt_hash(messages[0]["content"])

    router = RitaTurnRouter(
        state=state,
        prepare_turn=prepare_turn,
        language_of_turn=lambda: turn_language() if turn_language() in {"ar", "de", "en"} else "ar",
        mode=router_state,
        session_id=session_id,
        trace_id=latency.trace_id,
        turn_id=lambda: latency.turn,
        lesson=lesson_voice,
        raw=raw_chat,
    )

    def refresh_prompt() -> None:
        """Rebuilds the system prompt now (a new lesson step arrived between turns)."""
        messages = context.get_messages()
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = build_prompt(
                body,
                state,
                dialogue=router_state == RouterMode.ON,
                lesson_voice=lesson_voice,
                study_voice=study_voice,
            )

    async def say_line(text: str) -> None:
        """Speaks one exact line from the website and shows the same text in the chat."""
        line = clean_say(text)
        if not line:
            return
        await task.queue_frames(
            [
                RTVIServerMessageFrame(data={"type": "rita-spoken-text", "text": line}),
                TTSSpeakFrame(line, append_to_context=True),
            ]
        )

    # The written part of a long answer (after [[SHEET]]) is shown on the page, never spoken.
    sheet_splitter = RitaSheetSplitter(
        look_below=lambda: {
            "en": "Have a look below.",
            "de": "Schau unten.",
        }.get(state.reply_language() or "ar", "شوف الشرح تحت.")
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            router,
            llm,
            sheet_splitter,
            RitaWordJoiner(),
            RitaSpeechCleaner(help_needed=state.help_needed, raw=raw_chat),
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
        ).info("Uzyra worker startup timing")

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
        ).info("Uzyra transport timing")

    @user_bot_observer.event_handler("on_latency_measured")
    async def on_user_bot_latency(observer, latency_seconds):
        logger.bind(
            session_id=session_id,
            turn_id=latency.turn,
            latency_ms=round(latency_seconds * 1000, 2),
        ).info("Uzyra user-to-bot speaking signal latency")

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

    @task.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        # In a lesson Uzyra speaks first; in a free conversation she waits for the learner.
        if opens_lesson(body) and not saved_history:
            logger.info("Uzyra opens the lesson")
            await task.queue_frames([LLMRunFrame()])

    @task.rtvi.event_handler("on_client_message")
    async def on_client_message(rtvi, msg):
        # The learner's "Stop Uzyra" button: a sure way to interrupt that does not depend on
        # the microphone, the noise around them or what the speech recognizer heard.
        if getattr(msg, "type", "") == "rita-learning-count":
            # How many words the learner has in the list on screen ("open the list" needs it).
            try:
                count = int((getattr(msg, "data", None) or {}).get("count"))
                state.learning_count = max(0, min(count, 1000))
            except (TypeError, ValueError, AttributeError):
                state.learning_count = None
            return
        if getattr(msg, "type", "") == "rita-settings":
            # "Uzyra explains in" was changed on the website during the conversation.
            value = (getattr(msg, "data", None) or {}).get("explanationLanguage")
            if state.set_site_language(value):
                logger.info(
                    "Uzyra explanation language changed on the website language={} source={}",
                    state.active_language,
                    state.language_source.value,
                )
            return
        if getattr(msg, "type", "") == "rita-lesson-step":
            # The website's lesson engine moved: keep the step, then say its line or let the
            # model teach it ("model" for the intro and the explanation of a part).
            data = getattr(msg, "data", None) or {}
            if lesson_voice is None or not lesson_voice.set_step(data):
                return
            refresh_prompt()
            logger.info(
                "Uzyra lesson step phase={} revision={} action={}",
                lesson_voice.phase,
                data.get("revision"),
                data.get("action"),
            )
            if data.get("say"):
                await say_line(data.get("say"))
            if data.get("action") == "model":
                await task.queue_frames([LLMRunFrame()])
            return
        if getattr(msg, "type", "") == "rita-lesson-say":
            if lesson_voice is not None:
                await say_line((getattr(msg, "data", None) or {}).get("text"))
            return
        message_type = getattr(msg, "type", "")
        if message_type.startswith("rita-study-"):
            # Decided in rita_study_voice (tested there); only a study session acts on these.
            recent_replies = [
                item["content"]
                for item in context.get_messages()
                if item.get("role") == "assistant" and isinstance(item.get("content"), str)
            ]
            data = getattr(msg, "data", None)
            effects = handle_study_message(study_voice, message_type, data, recent_replies)
            if effects.say:
                await say_line(effects.say)
            if effects.interrupt:
                await rtvi.interrupt_bot()
            if effects.refresh_prompt:
                refresh_prompt()
            if effects.user_line:
                context.add_message({"role": "user", "content": effects.user_line})
                logger.info("Uzyra study action message={}", message_type)
            if effects.ack:
                await task.rtvi.send_server_message(effects.ack)
            if effects.run_model:
                await task.queue_frames([LLMRunFrame()])
            return
        if getattr(msg, "type", "") == "rita-stop":
            logger.info("Uzyra stopped by the learner's button")
            state.topic_paused = True
            await rtvi.interrupt_bot()

    def ledger_state() -> dict[str, object]:
        """What Uzyra had read from the learner's turn, copied from state that already exists."""

        return {
            "lang": state.active_language,
            "lang_src": state.language_source.value,
            "explain_lang": state.reply_language(),
            "act": state.last_act.value,
            "resp": state.response_type.value,
            "task": state.current_task or None,
            "how_to_say": True if state.asked_how_to_say else None,
            "prompt": ledger_meta["prompt_hash"] or None,
        }

    async def send_ledger(record: dict[str, object]) -> None:
        """One realtime message and one log line per turn; never on the audio path."""

        logger.info("Uzyra turn ledger {}", json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        try:
            await task.rtvi.send_server_message(record)
        except Exception as error:  # diagnostics must never disturb the conversation
            logger.warning("Uzyra turn ledger could not be sent error={}", type(error).__name__)

    @user_aggregator.event_handler("on_user_turn_stopped")
    async def on_user_turn_stopped(aggregator, strategy, message):
        latency.mark("turn_committed")
        for record in ledger.unanswered_before(latency.turn, ledger_state()):
            asyncio.create_task(send_ledger(record))
        ledger.user_turn_committed(
            latency.turn,
            {
                "stop": getattr(strategy, "last_stop_path", None)
                if strategy is not None
                else "timeout",
                "wait_ms": getattr(strategy, "last_wait_ms", None) if strategy is not None else None,
                "resumed": (getattr(strategy, "last_resume_count", 0) or None)
                if strategy is not None
                else None,
                "words": len(message.content.split()),
            },
        )
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
        elif message.content.strip():
            committed_context_size = len(context.get_messages())

            async def recover_if_still_unrouted() -> None:
                # This event fires before the already-queued context frame reaches
                # the downstream router. Yield long enough for that normal path to
                # run, then retry only if its monotonic marker is still behind.
                # Running the check inline duplicated every healthy model call.
                await asyncio.sleep(0.15)
                if router.last_routed_context_size >= committed_context_size:
                    return
                logger.warning(
                    "Uzyra recovering committed turn that missed the router "
                    "context_size={} last_routed_context_size={}",
                    committed_context_size,
                    router.last_routed_context_size,
                )
                await aggregator.push_context_frame()

            asyncio.create_task(recover_if_still_unrouted())
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
        ).info("Uzyra user turn committed")

    @assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message):
        state.observe_assistant_turn(message.content)
        sheet = sheet_splitter.take_sheet()
        if sheet:
            # Uzyra remembers what she wrote, not only what she said, so she can build on it.
            for item in reversed(context.get_messages()):
                if item.get("role") == "assistant" and isinstance(item.get("content"), str):
                    item["content"] = f"{item['content'].rstrip()}\n{MARKER_LINE}\n{sheet}"
                    break
        answered_turn = (
            latency.reply_turn if ledger.has_open(latency.reply_turn) else ledger.newest_open_turn()
        )
        if answered_turn:

            async def finish_ledger(turn: int, spoken_chars: int) -> None:
                # The interruption frame reaches the observer a moment after this handler.
                await asyncio.sleep(0.25)
                cut = latency.interrupted_after_ms(turn)
                record = ledger.assistant_turn_stopped(
                    turn,
                    {
                        **ledger_state(),
                        "route": router.last_action,
                        "interrupted": cut is not None,
                        "cut_after_ms": cut,
                        "chars": spoken_chars,
                        "finish": latency.detail(turn, "groq_finish_reason", "finish_reason"),
                        "commit_ms": latency.offset_ms(turn, "turn_committed"),
                        "stt_final_ms": latency.offset_ms(turn, "stt_first_final"),
                        "llm_first_ms": latency.offset_ms(turn, "llm_first_answer_text"),
                        "tts_bytes_ms": latency.offset_ms(turn, "tts_first_bytes"),
                        "first_audio_ms": latency.offset_ms(turn, "worker_first_audio_frame"),
                    },
                )
                if record is not None:
                    await send_ledger(record)

            asyncio.create_task(finish_ledger(answered_turn, len(message.content)))
        logger.bind(
            session_id=session_id,
            trace_id=latency.trace_id or None,
            turn_id=latency.turn,
            spoken_characters=len(message.content),
        ).info("Uzyra assistant turn committed")

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        latency.session_mark("daily_participant_joined")
        await transport.capture_participant_audio(participant["id"], sample_rate=16_000)
        latency.session_mark("daily_audio_capture_started")

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    if body.get("freeTalk"):
        from free_talk_guard import run_with_deadline
        await run_with_deadline(lambda: runner.run(task), lambda: task.cancel(), body["freeTalk"])
    else:
        await runner.run(task)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()

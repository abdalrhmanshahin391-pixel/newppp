"""Rita Realtime Voice Engine v3 production worker.

Daily WebRTC -> Soniox stt-rt-v5 -> Smart Turn v3 ->
Groq openai/gpt-oss-120b -> Gemini 3.8 Flash-Lite TTS -> Daily WebRTC.

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
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMAssistantAggregatorParams,
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.run import main
from pipecat.runner.types import DailyRunnerArguments
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.soniox.stt import (
    SonioxContextGeneralItem,
    SonioxContextObject,
    SonioxSTTService,
)
from pipecat.transcriptions.language import Language
from pipecat.transports.daily.transport import DailyParams, DailyTransport
from pipecat.turns.user_stop import TurnAnalyzerUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.utils.context.llm_context_summarization import (
    LLMAutoContextSummarizationConfig,
    LLMContextSummaryConfig,
)

from rita_gemini_tts import RitaGeminiTTSService
from rita_interruption import RitaUserTurnStartStrategy
from rita_state import RitaSessionState

load_dotenv(override=False)

STT_MODEL = "stt-rt-v5"
LLM_MODEL = "openai/gpt-oss-120b"
TTS_MODEL = "gemini-3.8-flash-lite-tts"
TTS_VOICE = os.getenv("RITA_GEMINI_VOICE", "Achernar").strip() or "Achernar"
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


def build_prompt(body: dict[str, Any], state: RitaSessionState) -> str:
    personality = str(body.get("personality", "kind"))
    profile_language = str(body.get("language", "automatic"))
    remembered_dialect = str(body.get("dialect", "ar-JO"))
    mode = str(body.get("mode", "free_conversation"))
    return f"""You are Rita, RitaJet's realtime language tutor.

Delivery: {PERSONALITIES.get(personality, PERSONALITIES['kind'])}
Profile language: {profile_language}. Stable Arabic dialect: {remembered_dialect}.
Lesson mode: {mode}.
Structured session state: {state.prompt_state()}.

VOICE CONTRACT
- Speak for the ear, never for a page. Start with the useful answer; never restate the question.
- Default to one to three short spoken sentences. Give one teaching correction at a time.
- Put a natural full stop after the first short, meaningful clause so streaming TTS can begin early.
- No markdown, lists, headings, JSON, code fences, URLs, citations, or stage directions in speech.
- Never read internal metadata, learning extraction, or tool data aloud.

LANGUAGE AND DIALECT
- Match the learner's stable conversation language. Arabic defaults to friendly Jordanian Arabic.
- Jordanian wording includes شو، بدي، عليك، مش. Do not drift to Iraqi شنو, Gulf, Egyptian, or formal
  Arabic unless the learner explicitly asks.
- One German or English word inside Arabic is code-switching, not a language change.
- Change the conversation language only after an explicit request or clear sustained evidence.
- When the profile is automatic and no language is stable yet, answer in turn_language. After stability,
  use active_language. Never switch because of one borrowed or target-language word.
- Pronounce German and English target words naturally inside Arabic sentences.

TEACHING CONTROL
- If the learner says they understand or says move on, do not repeat the previous explanation.
- If the same correction fails twice, change strategy: slower example, minimal pair, syllable isolation,
  or a different analogy. Do not loop the same feedback.
- Never repeat last_feedback when attempt_count is two or more; visibly change teaching method.
- Ordinary conversation is not a pronunciation score. In a pronunciation drill, state uncertainty when
  audio is noisy and correct only the highest-impact issue.
- Never turn a general-knowledge answer into vocabulary or flashcards.
- Never claim Flashcards or German Lab were saved; the website confirms only after a real transaction.
- If unsure what was heard, ask one short clarification in the same stable language.
"""


async def bot(args: DailyRunnerArguments):
    body = args.body if isinstance(args.body, dict) else {}
    state = RitaSessionState(
        active_language=str(body.get("language", "automatic")),
        active_dialect=str(body.get("dialect", "ar-JO")),
    )
    logger.bind(session_id=args.session_id).info("Starting Rita v3 session")

    transport = DailyTransport(
        args.room_url,
        args.token,
        "Rita",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_in_enabled=False,
        ),
    )

    stt = SonioxSTTService(
        api_key=require_secret("SONIOX_API_KEY"),
        url=SONIOX_URL,
        vad_force_turn_endpoint=True,
        settings=SonioxSTTService.Settings(
            model=STT_MODEL,
            language_hints=[Language.AR, Language.DE, Language.EN],
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
                ],
                terms=[
                    "RitaJet",
                    "German Lab",
                    "Flashcards",
                    "Guten Morgen",
                    *lesson_terms(body),
                ],
            ),
        ),
    )

    llm = GroqLLMService(
        api_key=require_secret("GROQ_API_KEY"),
        settings=GroqLLMService.Settings(
            model=LLM_MODEL,
            temperature=0.45,
            top_p=0.9,
            max_completion_tokens=240,
            reasoning_effort="low",
        ),
    )

    tts = RitaGeminiTTSService(
        api_key=require_secret("GOOGLE_API_KEY"),
        model=TTS_MODEL,
        voice=TTS_VOICE,
    )

    context = LLMContext(
        [
            {"role": "system", "content": build_prompt(body, state)},
            {"role": "assistant", "content": "Hi, I’m Rita. What would you like to practise?"},
        ]
    )
    vad = SileroVADAnalyzer(params=VADParams(stop_secs=0.2))
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            user_turn_strategies=UserTurnStrategies(
                start=[RitaUserTurnStartStrategy()],
                stop=[
                    TurnAnalyzerUserTurnStopStrategy(
                        turn_analyzer=LocalSmartTurnAnalyzerV3()
                    )
                ]
            ),
            user_turn_stop_timeout=1.5,
            vad_analyzer=vad,
        ),
        assistant_params=LLMAssistantAggregatorParams(
            enable_auto_context_summarization=True,
            auto_context_summarization_config=LLMAutoContextSummarizationConfig(
                max_context_tokens=4_500,
                max_unsummarized_messages=12,
                summary_config=LLMContextSummaryConfig(
                    target_context_tokens=1_200,
                    min_messages_after_summary=8,
                    summarization_prompt=(
                        "Summarize only the learner's goal, stable language/dialect, words taught, "
                        "confirmed understanding, unresolved correction, and tool results."
                    ),
                    llm=llm,
                ),
            ),
        ),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
            audio_in_sample_rate=16_000,
            audio_out_sample_rate=24_000,
        ),
        enable_turn_tracking=True,
    )

    @user_aggregator.event_handler("on_user_turn_stopped")
    async def on_user_turn_stopped(aggregator, strategy, message):
        state.observe_user_turn(message.content)
        messages = context.get_messages()
        if messages and messages[0].get("role") == "system":
            messages[0]["content"] = build_prompt(body, state)
        logger.bind(
            response_type=state.response_type,
            language=state.active_language,
            dialect=state.active_dialect,
        ).info("Rita user turn committed")

    @assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message):
        state.observe_assistant_turn(message.content)
        logger.bind(heard_text=message.content).info("Rita assistant heard-text committed")

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        await transport.capture_participant_audio(participant["id"], sample_rate=16_000)

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        await task.cancel()

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)


if __name__ == "__main__":
    main()

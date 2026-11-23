"""A free conversation reaches Groq with its own short prompt and fixed settings only: no opener,
no turn notes, never the long tutor prompt, and the reply is spoken as the model wrote it.
Lessons and books keep their prompts."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bot  # noqa: E402
from rita_state import RitaSessionState  # noqa: E402

FREE = {"mode": "free_conversation", "targetLanguage": {"code": "en", "name": "English", "speechCode": "en"}}


def never():
    raise AssertionError("a free conversation must not build a system prompt")


SHORT = {"role": "system", "content": bot.free_talk_prompt(bot.parse_target_language(FREE))}


def test_a_free_conversation_starts_with_its_short_prompt_only():
    assert bot.first_messages(FREE, [], never) == [SHORT]
    history = [{"role": "user", "content": "مرحبا"}, {"role": "assistant", "content": "أهلين"}]
    assert bot.first_messages(FREE, history, never) == [SHORT, *history]
    # Spoken, short, fact first: the prompt keeps it to a sentence or two and no tables.
    assert "about 20 words" in bot.FREE_TALK_PROMPT
    assert "no tables" in bot.FREE_TALK_PROMPT


def test_lessons_and_books_keep_their_prompt():
    for body in ({"mode": "lesson", "lesson": {"brief": "x"}}, {"study": {"lessonId": "l1"}}):
        messages = bot.first_messages(body, [], lambda: "PROMPT")
        assert messages[0] == {"role": "system", "content": "PROMPT"}


def test_the_request_to_groq_holds_the_short_prompt_the_chat_and_its_settings():
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.services.groq.llm import GroqLLMService

    from rita_groq_llm import RitaGroqLLMService
    from rita_latency import RitaLatencyRecorder

    llm = RitaGroqLLMService(
        api_key="test",
        latency_recorder=RitaLatencyRecorder(session_id="t"),
        turn_options=None,
        settings=GroqLLMService.Settings(
            model=bot.LLM_MODEL,
            temperature=bot.FREE_TALK_SETTINGS["temperature"],
            top_p=bot.FREE_TALK_SETTINGS["top_p"],
            max_completion_tokens=bot.FREE_TALK_SETTINGS["max_completion_tokens"],
            extra={"reasoning_effort": bot.FREE_TALK_SETTINGS["reasoning_effort"]},
        ),
    )
    context = LLMContext(bot.first_messages(FREE, [], never))
    context.add_message({"role": "user", "content": "مرحباً، كيف حالك؟"})
    params = llm.build_chat_completion_params(llm.get_llm_adapter().get_llm_invocation_params(context))
    assert params["messages"] == [SHORT, {"role": "user", "content": "مرحباً، كيف حالك؟"}]
    assert params["max_completion_tokens"] == bot.FREE_TALK_SETTINGS["max_completion_tokens"]
    assert params["reasoning_effort"] == "medium"


def test_the_reply_is_spoken_as_written_with_nothing_added():
    from pipecat.frames.frames import LLMFullResponseEndFrame, LLMFullResponseStartFrame, LLMTextFrame

    from rita_dialect import RitaSpeechCleaner

    cleaner = RitaSpeechCleaner(help_needed=lambda: True, raw=True)
    pushed = []

    async def push(frame, direction=None):
        pushed.append(frame)

    cleaner.push_frame = push

    async def run():
        from pipecat.processors.frame_processor import FrameDirection

        for frame in (LLMFullResponseStartFrame(), LLMTextFrame("أهلاً، إنتِ كيف؟ شو حابّة تحكي؟"), LLMFullResponseEndFrame()):
            await RitaSpeechCleaner.process_frame(cleaner, frame, FrameDirection.DOWNSTREAM)

    asyncio.run(run())
    texts = [f.text for f in pushed if isinstance(f, LLMTextFrame)]
    assert "".join(texts) == "أهلاً، إنتِ كيف؟ شو حابّة تحكي؟"  # no word swapped, no help line


def test_the_router_passes_every_free_turn_to_the_model_even_a_stop_word():
    from pipecat.frames.frames import LLMContextFrame
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.processors.frame_processor import FrameDirection

    from rita_turn_router import RitaTurnRouter

    state = RitaSessionState()
    seen = []
    router = RitaTurnRouter(
        state=state, prepare_turn=state.observe_user_turn, language_of_turn=lambda: "ar", raw=True
    )
    pushed = []

    async def push(frame, direction=None):
        pushed.append(frame)

    router.push_frame = push

    async def run():
        for text in ("خلص", "إيه", "مرحبا"):
            context = LLMContext([{"role": "user", "content": text}])
            frame = LLMContextFrame(context=context)
            await router.process_frame(frame, FrameDirection.DOWNSTREAM)
            seen.append(text)

    asyncio.run(run())
    assert [f.context.get_messages()[-1]["content"] for f in pushed if isinstance(f, LLMContextFrame)] == seen


def test_the_wiring_in_bot():
    source = (Path(bot.__file__).parent / "rita_turn_router.py").read_text(encoding="utf-8")
    block = source.split("if self._raw:", 1)[1].split("return", 1)[0]
    assert "push_frame(frame, direction)" in block
    bot_source = Path(bot.__file__).read_text(encoding="utf-8")
    assert "raw=raw_chat" in bot_source and "RitaSpeechCleaner(help_needed=state.help_needed, raw=raw_chat)" in bot_source
    assert "turn_options=None if raw_chat" in bot_source
    assert "enable_auto_context_summarization=not raw_chat" in bot_source
    assert 'extra={"reasoning_effort": FREE_TALK_SETTINGS["reasoning_effort"]},\n        )\n        if raw_chat' in bot_source
    # The long tutor prompt is never swapped in over the free conversation's short one.
    assert bot_source.count('if not raw_chat and messages and messages[0].get("role") == "system":') == 2
    assert RitaSessionState  # the state is still kept for the voice's language

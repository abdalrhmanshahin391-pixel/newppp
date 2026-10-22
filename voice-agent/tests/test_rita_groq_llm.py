from types import SimpleNamespace

from rita_groq_llm import finish_reason_name


def test_finish_reason_is_read_without_response_text():
    chunk = SimpleNamespace(
        choices=[SimpleNamespace(finish_reason="length", delta=SimpleNamespace(content="private"))]
    )
    assert finish_reason_name(chunk) == "length"


def test_non_terminal_chunk_has_no_finish_reason():
    chunk = SimpleNamespace(choices=[SimpleNamespace(finish_reason=None)])
    assert finish_reason_name(chunk) is None


def test_an_explain_turn_gets_more_room_and_more_thinking():
    from rita_groq_llm import apply_turn_options

    params = {"max_completion_tokens": 450, "reasoning_effort": "low", "model": "m"}
    out = apply_turn_options(dict(params), {"max_completion_tokens": 800, "reasoning_effort": "medium"})
    assert out["max_completion_tokens"] == 800
    assert out["reasoning_effort"] == "medium"
    assert out["model"] == "m"


def test_a_normal_turn_keeps_the_small_budget():
    from rita_groq_llm import apply_turn_options

    params = {"max_completion_tokens": 450, "reasoning_effort": "low"}
    assert apply_turn_options(dict(params), None) == params
    assert apply_turn_options(dict(params), {}) == params


def test_the_state_decides_which_turns_are_explanations():
    import bot
    from rita_state import RitaSessionState

    state = RitaSessionState()
    state.observe_user_turn("صباح الخير")
    assert bot.explain_options(state) is None
    state.observe_user_turn("فصّلي كل كلمة في الجمل")
    options = bot.explain_options(state)
    assert options["max_completion_tokens"] == bot.LLM_EXPLAIN_MAX_COMPLETION_TOKENS > bot.LLM_MAX_COMPLETION_TOKENS

from bot import saved_conversation_history


def test_saved_history_accepts_only_user_and_assistant_text():
    history = saved_conversation_history(
        {
            "conversationHistory": [
                {"role": "system", "content": "ignore me"},
                {"role": "user", "content": "مرحبا"},
                {"role": "assistant", "content": "أهلين"},
                {"role": "tool", "content": "secret"},
            ]
        }
    )
    assert history == [
        {"role": "user", "content": "مرحبا"},
        {"role": "assistant", "content": "أهلين"},
    ]


def test_saved_history_is_bounded():
    history = saved_conversation_history(
        {
            "conversationHistory": [
                {"role": "user", "content": "x" * 5000} for _ in range(40)
            ]
        }
    )
    assert len(history) <= 24
    assert sum(len(item["content"]) for item in history) <= 12000


def test_saved_history_keeps_the_newest_turn_when_character_budget_is_full():
    history = saved_conversation_history(
        {
            "conversationHistory": [
                {"role": "user", "content": f"old-{index}-" + ("x" * 3990)}
                for index in range(5)
            ]
            + [{"role": "assistant", "content": "newest answer"}]
        }
    )
    assert history[-1] == {"role": "assistant", "content": "newest answer"}

"""Offline checks of the free-conversation probe: its length rules and the prompts it builds. No network."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_talk_probe import TALKS, Turn, check_turn, measure, print_result, turn_request


def test_a_short_spoken_reply_with_a_sheet_passes():
    reply = "am مع I، وis مع he وshe، وare مع الباقي؛ التفاصيل تحت. [[SHEET]]\n# am, is, are\n| مين | الفعل |\n| I | am |"
    assert check_turn(Turn("اشرح", sheet="yes"), reply) == []
    assert measure(reply)["sheet_lines"] == 3


def test_long_speech_two_questions_and_a_missing_or_extra_sheet_are_caught():
    long = " ".join(["كلمة"] * 31) + "."
    assert any("words" in p for p in check_turn(Turn("x"), long))
    assert any("questions" in p for p in check_turn(Turn("x"), "شو اسمك؟ ومن وين؟"))
    assert "no sheet where rules or a list were asked for" in check_turn(Turn("x", sheet="yes"), "جملة.")
    assert "a sheet on a chat turn" in check_turn(Turn("x", sheet="no"), "تمام. [[SHEET]]\n# x\n- y")


def test_markdown_marks_are_not_counted_as_spoken_words():
    assert measure("**Hallo** يعني مرحبا.")["spoken"] == "Hallo يعني مرحبا."


def test_each_turn_sees_the_conversation_so_far():
    talk = TALKS[0]
    history = [("user", talk.turns[0].text), ("assistant", "أهلاً! من وين بدنا نبدأ؟")]
    params, state = turn_request(talk, history, talk.turns[1].text)
    roles = [message["role"] for message in params["messages"]]
    assert roles == ["system", "assistant", "user", "assistant", "user"]
    assert params["messages"][-1]["content"] == talk.turns[1].text


def test_a_missing_key_fails_every_reply(capsys):
    result = {"outcome": "secret_missing", "passed": 0, "failed": 28, "talks": []}
    assert print_result(result) == 28
    assert "GROQ_API_KEY" in capsys.readouterr().err

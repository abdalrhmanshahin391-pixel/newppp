"""Offline checks of the learners' conversation evaluation: the corpus, the model settings, the totals."""

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import rita_talk_eval
from rita_talk_eval import model_params, play, summarize
from rita_talk_eval_corpus import DEV, HOLDOUT
from rita_talk_probe import Turn, check_turn


def test_the_corpus_has_two_separate_parts_with_unique_conversations():
    ids = [talk.id for talk in DEV + HOLDOUT]
    assert len(ids) == len(set(ids))
    assert len(DEV) >= 15 and len(HOLDOUT) >= 10
    assert sum(len(talk.turns) for talk in DEV + HOLDOUT) >= 120
    for talk in DEV + HOLDOUT:
        assert talk.site_language in ("ar", "en")
        for turn in talk.turns:
            assert turn.sheet in ("yes", "no", "any")
            assert turn.want, f"{talk.id}: every turn says what a good reply does"


def test_expected_content_is_checked_with_arabic_letter_variants_folded():
    turn = Turn("شو يعني residency؟", must=("إقامة",))
    assert check_turn(turn, "residency يعني فترة الاقامة بالمستشفى.") == []
    assert any("expected content" in p for p in check_turn(turn, "يعني شغل بالمستشفى."))


def test_a_turn_that_asks_for_another_language_may_reply_without_arabic():
    assert check_turn(Turn("احكي ألماني", free_language=True), "Gut! Wie geht es dir?", "ar") == []
    assert "no Arabic for an Arabic speaker" in check_turn(Turn("x"), "Gut! Wie geht es dir?", "ar")


def test_model_settings_follow_each_model_family():
    base = {"model": "openai/gpt-oss-120b", "reasoning_effort": "low", "messages": []}
    assert model_params(base, "", "") == base
    assert model_params(base, "", "medium")["reasoning_effort"] == "medium"
    assert "reasoning_effort" not in model_params(base, "llama-3.3-70b-versatile", "")
    assert model_params(base, "qwen/qwen3-32b", "")["reasoning_effort"] == "none"
    assert model_params(base, "qwen/qwen3-32b", "high")["reasoning_format"] == "hidden"
    assert model_params(base, "openai/gpt-oss-20b", "")["reasoning_effort"] == "low"


def test_totals_count_missing_replies_as_failures():
    rows = [
        {"problems": [], "spoken": "x", "words": 5, "first_ms": 400},
        {"problems": ["too long"], "spoken": "y", "words": 30, "first_ms": 900},
    ]
    s = summarize(rows, 3)
    assert (s["passed"], s["failed"], s["first_word_ms_median"]) == (1, 2, 650)


class _Chunk(SimpleNamespace):
    pass


def _client(reply: str):
    async def stream():
        yield _Chunk(choices=[SimpleNamespace(delta=SimpleNamespace(content=reply), finish_reason=None)])
        yield _Chunk(choices=[SimpleNamespace(delta=SimpleNamespace(content=None), finish_reason="stop")])

    async def create(**params):
        assert params["stream"] is True
        return stream()

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_a_conversation_is_played_turn_by_turn_with_timing():
    talk = DEV[0]
    reply = 'أهلا! بتدرس طب؟ قول "I study medicine".'
    rows = asyncio.run(play(_client(reply), talk, "dev", "", "", asyncio.Semaphore(1)))
    assert [row["turn"] for row in rows] == list(range(1, len(talk.turns) + 1))
    assert all(row["first_ms"] is not None for row in rows)
    assert rows[0]["spoken"].startswith("أهلا")


def test_print_reports_a_missing_key(capsys):
    result = {"outcome": "secret_missing", "summary": {"failed": 7}}
    assert rita_talk_eval.print_eval(result) == 7

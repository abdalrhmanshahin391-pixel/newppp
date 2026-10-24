import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bot
from rita_latency import RitaLatencyRecorder
from rita_state import RitaSessionState
from rita_turn_ledger import (
    MAX_BYTES,
    MESSAGE_TYPE,
    TurnLedger,
    build_id,
    compact,
    fixed_prompt_hash,
    turn_ref,
)

SESSION = "11111111-2222-3333-4444-555555555555"


def committed(ledger, turn=1, **extra):
    ledger.user_turn_committed(turn, {"stop": "period", "wait_ms": 900, "words": 6, **extra})


def test_turn_ref_is_shared_by_session_and_turn():
    assert turn_ref(SESSION, 17) == f"{SESSION}-t-17"


def test_the_build_comes_from_the_deploy_and_is_short(monkeypatch):
    monkeypatch.setenv("RITA_GIT_SHA", "95bfb0416ff16b309347f30b6050dc03cd7afb0a")
    assert build_id() == "95bfb0416ff1"
    monkeypatch.delenv("RITA_GIT_SHA")
    assert build_id() == "unknown"


def test_the_prompt_hash_ignores_the_per_turn_state():
    a = bot.build_prompt({}, RitaSessionState(active_language="ar"), dialogue=True)
    state = RitaSessionState(active_language="en")
    state.observe_user_turn("فصّلي كل كلمة")
    b = bot.build_prompt({}, state, dialogue=True)
    assert a != b
    assert fixed_prompt_hash(a) == fixed_prompt_hash(b)
    changed = a.replace("You are Rita", "You are Rita2", 1)
    assert fixed_prompt_hash(changed) != fixed_prompt_hash(a)


def test_an_answered_turn_becomes_one_record_with_the_shared_ref(monkeypatch):
    monkeypatch.setenv("RITA_GIT_SHA", "abc123")
    ledger = TurnLedger(SESSION, learn_language="de")
    committed(ledger, 3)
    record = ledger.assistant_turn_stopped(3, {"interrupted": True, "cut_after_ms": 2100, "chars": 120})
    assert record["type"] == MESSAGE_TYPE and record["v"] == 1
    assert record["turn_ref"] == f"{SESSION}-t-3" and record["turn"] == 3
    assert record["build"] == "abc123" and record["learn_lang"] == "de"
    assert record["answered"] is True and record["interrupted"] is True
    assert record["stop"] == "period" and record["wait_ms"] == 900
    assert ledger.assistant_turn_stopped(3, {}) is None, "a turn is reported once"


def test_a_turn_rita_never_answered_is_reported_when_the_next_one_arrives():
    ledger = TurnLedger(SESSION)
    committed(ledger, 1)
    committed(ledger, 2)
    records = ledger.unanswered_before(2, {"act": "stop"})
    assert [r["turn"] for r in records] == [1]
    assert records[0]["answered"] is False and records[0]["act"] == "stop"
    assert ledger.has_open(2) and not ledger.has_open(1)


def test_an_answer_with_no_committed_turn_is_ignored():
    assert TurnLedger(SESSION).assistant_turn_stopped(5, {"interrupted": False}) is None


def test_old_open_turns_are_bounded():
    ledger = TurnLedger(SESSION, keep=3)
    for turn in range(1, 8):
        committed(ledger, turn)
    assert ledger.newest_open_turn() == 7
    assert not ledger.has_open(1) and ledger.has_open(5)


def test_a_record_stays_under_one_kilobyte_and_has_no_text():
    ledger = TurnLedger(SESSION, learn_language="de")
    committed(ledger, 1, words=12, lang="ar", lang_src="explicit", explain_lang="en", act="teach",
              task="break the phrase down word by word", route="pass")
    record = ledger.assistant_turn_stopped(
        1,
        {
            "interrupted": False, "chars": 300, "finish": "stop", "commit_ms": 950,
            "stt_final_ms": 120, "llm_first_ms": 380, "tts_bytes_ms": 160, "first_audio_ms": 200,
            "prompt": "a1b2c3d4", "resp": "explain", "how_to_say": True,
        },
    )
    assert len(json.dumps(record, ensure_ascii=False, separators=(",", ":")).encode()) <= MAX_BYTES
    assert not any(key in record for key in ("text", "transcript", "content", "reply", "token", "key"))


def test_compact_drops_empty_values_then_the_least_useful_fields():
    record = {"a": None, "b": 1, "task": "x" * 600, "route": "pass", "turn_ref": "t"}
    out = compact(record, limit=200)
    assert "a" not in out and out["b"] == 1 and out["turn_ref"] == "t"
    assert "task" not in out


def test_the_recorder_reports_a_real_interruption_once_and_ignores_idle_ones():
    recorder = RitaLatencyRecorder(SESSION)
    recorder.start_turn("f1")
    recorder.interruption("i0")  # nothing is being said: not an interruption of a reply
    assert recorder.interrupted_after_ms(1) is None
    recorder.reply_started("r1")
    recorder.bot_started_speaking()
    recorder.interruption("i1")
    recorder.interruption("i1")  # the same frame seen again at the next hop
    first = recorder.interrupted_after_ms(1)
    assert first is not None and first >= 0
    recorder.interruption("i2")
    assert recorder.interrupted_after_ms(1) == first


def test_a_reply_that_finished_is_not_interrupted_afterwards():
    recorder = RitaLatencyRecorder(SESSION)
    recorder.start_turn("f1")
    recorder.reply_started("r1")
    recorder.bot_started_speaking()
    recorder.bot_stopped_speaking()
    recorder.start_turn("f2")
    recorder.interruption("i1")
    assert recorder.interrupted_after_ms(1) is None
    assert recorder.interrupted_after_ms(2) is None


def test_the_recorder_gives_offsets_and_details_for_the_ledger():
    recorder = RitaLatencyRecorder(SESSION)
    recorder.start_turn("f1")
    recorder.mark("speech_end")
    recorder.mark("turn_committed")
    recorder.mark("groq_finish_reason", finish_reason="length", truncated=True)
    assert recorder.offset_ms(1, "turn_committed") >= 0
    assert recorder.offset_ms(1, "llm_first_answer_text") is None
    assert recorder.detail(1, "groq_finish_reason", "finish_reason") == "length"
    assert recorder.detail(1, "groq_finish_reason", "nothing") is None

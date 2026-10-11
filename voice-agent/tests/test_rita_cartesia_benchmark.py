import json
from array import array

from rita_cartesia_benchmark import (
    MODEL_ID,
    SAMPLE_RATE,
    VOICE_ID,
    build_ws_message,
    acoustic_onset_ms,
    conservative_acoustic_onset_ms,
    energy_onset_profile,
    evaluate_trim_candidate,
    first_non_silent_sample_ms,
    summarize_samples,
    summarize_trim_safety,
)


def test_websocket_payload_matches_rita_and_includes_selected_buffer():
    message = build_ws_message(
        context_id="ctx",
        transcript="مرحبا ",
        language="ar",
        continue_transcript=True,
        max_buffer_delay_ms=50,
    )

    assert message["model_id"] == MODEL_ID == "sonic-3.6"
    assert message["voice"] == {"mode": "id", "id": VOICE_ID}
    assert message["language"] == "ar"
    assert message["continue"] is True
    assert message["max_buffer_delay_ms"] == 50
    assert message["output_format"] == {
        "container": "raw",
        "encoding": "pcm_s16le",
        "sample_rate": SAMPLE_RATE,
    }
    assert message["add_timestamps"] is False


def test_default_buffer_is_omitted_instead_of_being_misreported_as_zero():
    message = build_ws_message(
        context_id="ctx",
        transcript="Guten ",
        language="de",
        continue_transcript=True,
        max_buffer_delay_ms=None,
    )
    assert "max_buffer_delay_ms" not in message


def test_first_non_silent_offset_uses_pcm_sample_position():
    samples = array("h", [0] * 24 + [700] + [0] * 10)
    assert first_non_silent_sample_ms(samples.tobytes(), sample_rate=24_000) == 1.0


def test_conservative_acoustic_oracle_detects_very_quiet_sustained_onset():
    samples = array("h", [0] * 100 + [3] * 10 + [0] * 10)
    assert conservative_acoustic_onset_ms(
        samples.tobytes(), sample_rate=1000, frame_ms=5
    ) == 100.0


def test_explicit_energy_floor_ignores_provider_like_noise():
    samples = array("h", [12] * 100 + [300] * 10)
    assert acoustic_onset_ms(
        samples.tobytes(),
        rms_floor=32,
        peak_floor=128,
        sample_rate=1000,
        frame_ms=5,
    ) == 100.0


def test_energy_profile_contains_all_calibration_floors_without_audio():
    profile = energy_onset_profile(array("h", [0] * 240 + [500] * 240).tobytes())
    assert profile["rms_2_peak_8"] == 10.0
    assert profile["rms_125_peak_500"] == 10.0
    assert all(not isinstance(value, (bytes, bytearray)) for value in profile.values())


def test_timestamp_flags_are_opt_in_for_private_safety_benchmark():
    message = build_ws_message(
        context_id="ctx",
        transcript="Hallo",
        language="de",
        continue_transcript=True,
        max_buffer_delay_ms=0,
        add_timestamps=True,
        add_phoneme_timestamps=True,
    )
    assert message["add_timestamps"] is True
    assert message["add_phoneme_timestamps"] is True


def test_trim_candidate_requires_exact_suffix_and_phoneme_margin():
    silence = array("h", [0] * (SAMPLE_RATE // 10)).tobytes()
    speech = array("h", [500] * (SAMPLE_RATE // 20)).tobytes()
    result = evaluate_trim_candidate(
        [silence[:1001], silence[1001:] + speech],
        first_phoneme_ms=100.0,
        preroll_ms=40,
    )
    assert result["exact_suffix"] is True
    assert result["safe"] is True
    assert result["safety_margin_ms"] >= 20


def test_trim_summary_refuses_any_unsafe_sample():
    samples = [
        {
            "candidates": [
                {
                    "preroll_ms": preroll,
                    "first_phoneme_ms": 100.0,
                    "safety_margin_ms": 30.0,
                    "trimmed_ms": 70.0,
                    "exact_suffix": True,
                    "bypassed": False,
                    "safe": preroll != 20,
                }
                for preroll in (20, 30, 40)
            ]
        }
    ]
    summary = summarize_trim_safety(samples)
    assert summary["safe_to_enable"] is True
    assert summary["selected_preroll_ms"] == 40
    rejected = next(item for item in summary["candidates"] if item["preroll_ms"] == 20)
    assert rejected["qualified"] is False


def test_summary_uses_only_warm_successful_samples_and_contains_no_payload():
    samples = [
        {
            "phase": "warm",
            "language": "ar",
            "buffer_ms": 100,
            "first_chunk_ms": value,
            "first_non_silent_pcm_ms": value + 1,
            "first_audible_playout_estimate_ms": value + 21,
            "leading_silence_ms": 20,
            "complete_ms": value + 100,
            "max_inter_chunk_gap_ms": 20,
        }
        for value in (80, 90, 100)
    ]
    samples.append(
        {
            "phase": "first_after_connect",
            "language": "ar",
            "buffer_ms": 100,
            "first_chunk_ms": 900,
        }
    )

    summary = next(
        row
        for row in summarize_samples(samples)
        if row["buffer_ms"] == 100 and row["language"] == "ar"
    )
    assert summary["first_chunk_median_ms"] == 90
    assert summary["first_non_silent_pcm_median_ms"] == 91
    assert summary["first_audible_playout_estimate_median_ms"] == 111
    assert summary["leading_silence_median_ms"] == 20
    serialized = json.dumps(summary)
    assert "transcript" not in serialized
    assert "audio" not in serialized

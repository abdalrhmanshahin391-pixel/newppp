from array import array

from rita_leading_silence import LeadingSilenceTrimmer


def pcm(*samples: int) -> bytes:
    return array("h", samples).tobytes()


def repeated(value: int, count: int) -> bytes:
    return array("h", [value] * count).tobytes()


def test_trims_only_before_onset_and_keeps_exact_suffix():
    raw = repeated(0, 100) + repeated(300, 10) + repeated(-700, 40)
    trimmer = LeadingSilenceTrimmer(
        sample_rate=1000, frame_ms=5, preroll_ms=20, max_hold_ms=250
    )

    output = trimmer.process(raw)

    assert trimmer.decision is not None
    assert trimmer.decision.bypassed is False
    assert trimmer.decision.trimmed_ms == 80
    assert output == raw[80 * 2 :]


def test_quiet_fricative_is_preserved_before_stronger_vowel():
    silence = repeated(0, 80)
    quiet_fricative = repeated(30, 20)
    vowel = repeated(600, 30)
    raw = silence + quiet_fricative + vowel
    trimmer = LeadingSilenceTrimmer(
        sample_rate=1000, frame_ms=5, preroll_ms=20, max_hold_ms=250
    )

    output = trimmer.process(raw)

    # The conservative detector confirms on the stronger vowel at 100ms. The
    # 20ms pre-roll still preserves the entire quiet consonant byte-for-byte.
    assert trimmer.decision is not None
    assert trimmer.decision.onset_ms == 100
    assert trimmer.decision.trimmed_ms == 80
    assert output == raw[80 * 2 :]
    assert quiet_fricative in output


def test_immediate_speech_is_never_trimmed():
    raw = repeated(500, 20)
    trimmer = LeadingSilenceTrimmer(
        sample_rate=1000, frame_ms=5, preroll_ms=20, max_hold_ms=250
    )

    assert trimmer.process(raw) == raw
    assert trimmer.decision is not None
    assert trimmer.decision.trimmed_ms == 0


def test_all_silence_is_fail_open_on_finish():
    raw = repeated(0, 100)
    trimmer = LeadingSilenceTrimmer(sample_rate=1000, frame_ms=5, max_hold_ms=250)

    assert trimmer.process(raw) == b""
    assert trimmer.finish() == raw
    assert trimmer.decision is not None
    assert trimmer.decision.bypassed is True


def test_maximum_hold_is_fail_open_instead_of_discarding_audio():
    raw = repeated(0, 250)
    trimmer = LeadingSilenceTrimmer(sample_rate=1000, frame_ms=5, max_hold_ms=250)

    assert trimmer.process(raw) == raw
    assert trimmer.decision is not None
    assert trimmer.decision.bypassed is True
    assert trimmer.decision.trimmed_ms == 0


def test_pcm_sample_split_between_chunks_is_reassembled_exactly():
    raw = repeated(0, 20) + repeated(500, 20)
    trimmer = LeadingSilenceTrimmer(
        sample_rate=1000, frame_ms=5, preroll_ms=10, max_hold_ms=250
    )
    chunks = [raw[:3], raw[3:17], raw[17:41], raw[41:]]

    output = b"".join(trimmer.process(chunk) for chunk in chunks) + trimmer.finish()

    assert trimmer.decision is not None
    assert trimmer.decision.trimmed_ms == 10
    assert output == raw[10 * 2 :]


def test_pauses_after_opening_are_never_removed():
    first = repeated(0, 20) + repeated(500, 20)
    internal_pause_and_speech = repeated(0, 100) + repeated(400, 20)
    trimmer = LeadingSilenceTrimmer(
        sample_rate=1000, frame_ms=5, preroll_ms=10, max_hold_ms=250
    )

    output = trimmer.process(first) + trimmer.process(internal_pause_and_speech)

    assert output.endswith(internal_pause_and_speech)


def test_cancellation_discards_buffered_unplayed_audio():
    trimmer = LeadingSilenceTrimmer(sample_rate=1000, frame_ms=5, max_hold_ms=250)
    assert trimmer.process(repeated(0, 100)) == b""

    trimmer.cancel()

    assert trimmer.finish() == b""
    assert trimmer.process(repeated(500, 20)) == b""


def test_configuration_rejects_unsafe_values():
    try:
        LeadingSilenceTrimmer(sample_rate=0)
    except ValueError as error:
        assert "sample_rate" in str(error)
    else:
        raise AssertionError("invalid sample rate should fail")

    try:
        LeadingSilenceTrimmer(preroll_ms=250, max_hold_ms=250)
    except ValueError as error:
        assert "preroll_ms" in str(error)
    else:
        raise AssertionError("unsafe pre-roll should fail")

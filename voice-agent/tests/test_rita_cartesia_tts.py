from rita_cartesia_tts import RitaCartesiaTTSService


def test_turn_language_is_conservative_and_never_switches_to_an_unknown_locale():
    service = object.__new__(RitaCartesiaTTSService)
    service._rita_language = "ar"

    service.set_turn_language("de")
    assert service._rita_language == "de"

    service.set_turn_language("en")
    assert service._rita_language == "en"

    service.set_turn_language("automatic")
    assert service._rita_language == "ar"

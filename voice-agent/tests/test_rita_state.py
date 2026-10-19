from rita_state import LanguageSource, ResponseType, RitaSessionState, infer_turn_language


def test_code_switched_arabic_does_not_become_german():
    assert infer_turn_language("شو معنى Guten Morgen بالألماني؟") == "ar"
    assert infer_turn_language("شو معنى Guten Morgen؟") == "ar"


def test_automatic_language_needs_two_clear_turns():
    state = RitaSessionState()
    state.observe_user_turn("Can you help me practise English today?")
    assert state.active_language == "automatic"
    state.observe_user_turn("I want to work on natural conversation.")
    assert state.active_language == "en"
    assert state.language_source == LanguageSource.STABLE_AUTO


def test_explicit_jordanian_choice_is_sticky():
    state = RitaSessionState()
    state.observe_user_turn("احكي معي باللهجة الأردنية")
    state.observe_user_turn("Guten Morgen")
    assert state.active_language == "ar"
    assert state.active_dialect == "ar-JO"
    assert state.language_source == LanguageSource.EXPLICIT


def test_repeated_pronunciation_changes_strategy():
    state = RitaSessionState()
    state.observe_user_turn("كيف تنطق هاي الكلمة؟")
    state.observe_user_turn("مرة ثانية، لسا غلط")
    assert state.attempt_count >= 2
    assert state.response_type == ResponseType.CORRECTION
    assert "change-method" in state.prompt_state()


def test_understood_resets_teaching_loop():
    state = RitaSessionState(attempt_count=3, last_feedback_signature="same feedback")
    state.observe_user_turn("تمام فهمت، خلينا نكمل")
    assert state.understood is True
    assert state.attempt_count == 0
    assert state.last_feedback_signature == ""


def test_rejected_interpretations_are_bounded_and_enter_the_directive():
    state = RitaSessionState()
    for item in ("باي", "هاي", "بيت", "سيارة", "قهوة", "شاي"):
        state.observe_user_turn(f"مش {item}")
    assert state.rejected_interpretations == ["هاي", "بيت", "سيارة", "قهوة", "شاي"]
    assert "do not return" in state.turn_directive()


def test_repeated_simplify_request_changes_method():
    state = RitaSessionState()
    state.observe_user_turn("اشرحي أبسط")
    assert state.response_type == ResponseType.SIMPLIFY
    assert state.attempt_count == 1
    state.observe_user_turn("يعني لشخص مبتدئ")
    assert state.attempt_count == 2
    assert "change method completely" in state.turn_directive()


def test_complaint_never_gets_a_made_up_diagnosis_directive():
    state = RitaSessionState()
    state.observe_user_turn("الصوت مقطع")
    assert state.response_type == ResponseType.COMPLAINT
    assert "do not invent a technical cause" in state.turn_directive()

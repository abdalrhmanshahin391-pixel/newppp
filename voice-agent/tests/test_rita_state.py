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


def test_a_confused_turn_becomes_a_plain_sentence_for_the_model():
    state = RitaSessionState()
    state.observe_user_turn("ما فهمت ولا كلمة")
    assert state.response_type == ResponseType.SIMPLIFY
    note = state.turn_note()
    assert "THE LEARNER IS CONFUSED" in note and "ONE concrete" in note


def test_the_second_confused_turn_changes_method():
    state = RitaSessionState()
    state.observe_user_turn("ما فهمت ولا كلمة")
    state.observe_user_turn("مش فاهم")
    assert "Change method completely" in state.turn_note()


def test_a_complaint_is_acknowledged_not_defended():
    state = RitaSessionState()
    state.observe_user_turn("You are so confused. You don't understand what I say.")
    assert state.response_type == ResponseType.COMPLAINT
    assert "Do not defend yourself" in state.turn_note()


def test_asking_for_every_word_is_an_explain_request_with_room_to_answer():
    state = RitaSessionState()
    state.observe_user_turn("فصّلي كل كلمة في الجمل")
    assert state.response_type == ResponseType.EXPLAIN
    assert "up to five short spoken sentences" in state.turn_note()


def test_the_note_is_left_out_when_the_dialogue_directive_already_says_it():
    state = RitaSessionState()
    state.observe_user_turn("ما فهمت ولا كلمة")
    assert state.turn_directive()
    assert state.turn_note(dialogue=True) == ""


def test_not_talking_about_a_letter_is_remembered_as_a_rejected_meaning():
    state = RitaSessionState()
    state.observe_user_turn("I wasn't talking about P")
    assert state.rejected_interpretations == ["P"]
    assert "P" in state.turn_directive()


def test_i_did_not_understand_is_not_understood():
    state = RitaSessionState()
    for text in ("ما فهمت ولا كلمة", "I don't understand", "ich verstehe nicht"):
        state.observe_user_turn(text)
        assert state.understood is False, text
    state.observe_user_turn("فهمت، شكراً")
    assert state.understood is True

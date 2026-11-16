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
    assert "at most two short spoken sentences" in state.turn_note()
    assert "[[SHEET]]" in state.turn_note()


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


def test_continue_after_a_word_by_word_request_continues_that_task():
    state = RitaSessionState()
    state.observe_user_turn("فصّلي كل كلمة في الجمل")
    assert state.current_task == "break the phrase down word by word"
    state.observe_assistant_turn("Ich habe Hunger: ich يعني أنا، habe يعني عندي.")
    state.observe_user_turn("كمّل")
    assert state.current_task
    directive = state.turn_directive()
    assert "continue the task you were doing" in directive and "word by word" in directive
    assert "suggest a new topic" in directive


def test_the_task_survives_short_follow_ups_and_ends_on_stop_or_a_new_topic():
    state = RitaSessionState()
    state.observe_user_turn("فصّلي كل كلمة في الجمل")
    for text in ("مرة ثانية", "مش فاهم", "أمم"):
        state.observe_user_turn(text)
        assert state.current_task, text
    state.observe_user_turn("خلص")
    assert state.current_task == ""
    state.observe_user_turn("translate this for me")
    assert state.current_task == "translate what the learner asks"
    state.observe_user_turn("Let's talk about my weekend in the mountains")
    assert state.current_task == ""


def test_the_last_quoted_foreign_phrase_is_remembered_for_the_state():
    state = RitaSessionState()
    state.observe_assistant_turn('بنقول "Ich habe Hunger". وبالعامية "عندي جوع".')
    assert state.current_phrase == "Ich habe Hunger"
    state.observe_assistant_turn("حلو، كمان مرة؟")
    assert state.current_phrase == "Ich habe Hunger"
    assert 'phrase="Ich habe Hunger"' in state.dialogue_state()


def test_no_task_means_the_plain_continue_directive():
    state = RitaSessionState()
    state.observe_user_turn("كمّل")
    assert state.turn_directive() == "continue the topic from where you stopped; do not restart or summarise"


def _types(lines: list[str]) -> list[str]:
    state = RitaSessionState(active_language="ar", active_dialect="ar-JO")
    state.set_site_language("ar")
    out = []
    for line in lines:
        state.observe_user_turn(line)
        out.append(state.response_type.value)
    return out


def test_a_feeling_is_a_listening_turn_and_stays_one_while_the_learner_keeps_talking():
    assert _types(["والله تعبان، عندي امتحان بكرا", "يعني درست بس كله طار", "طيب شو أعمل هلأ؟"]) == [
        "feelings",
        "feelings",
        "feelings",
    ]
    # "Why do you ask me all this?" is a push back, not a grammar "why".
    assert _types(["ليش بتسألني كل هالأسئلة؟"]) == ["feelings"]
    assert _types(["I'm useless"]) == ["feelings"]
    # "Let's go on", a sentence in the language or a word question ends listening.
    assert _types(["حاسة إني ولا اشي", "اه، يلا نكمل"]) == ["feelings", "answer_short"]
    assert _types(["تعبان كتير", "I work in a hospital"])[1] != "feelings"


def test_words_about_feelings_inside_a_word_question_or_a_longer_word_are_not_feelings():
    assert _types(["كيف بقول بالإنجليزي أنا تعبان؟"]) != ["feelings"]
    assert _types(["شو يعني stressed؟"]) != ["feelings"]
    assert _types(["شو أحسن مطعم بعمان؟"]) != ["feelings"]
    assert _types(["عندي امتحان آيلتس وخايف من السبيكنج"]) != ["feelings"]
    state = RitaSessionState()
    state.observe_user_turn("I'm useless")
    assert "LISTEN" in state.turn_note().upper() and "HOPELESS" in state.turn_note()


def test_hopeless_words_ask_about_harm_once_and_talk_of_harm_gets_help_at_once():
    state = RitaSessionState(active_language="ar", active_dialect="ar-JO")
    state.set_site_language("ar")
    state.observe_user_turn("الاثنين بدلوا إني أنا يوزلس")
    assert state.response_type.value == "feelings" and "HOPELESS" in state.turn_note()
    state.observe_assistant_turn("كلمة قاسية. بتجيك أفكار تأذي حالك؟")
    state.observe_user_turn("لا لا ما بفكر أأذي حالي، بس تعبان")
    assert not state.harm_signal and "already asked" in state.turn_note()
    state.observe_user_turn("ولا اشي بستاهل")
    assert "HOPELESS" not in state.turn_note()

    crisis = RitaSessionState()
    crisis.observe_user_turn("أحياناً بفكر إنه أحسن لو أختفي")
    assert crisis.response_type.value == "feelings"
    assert "911" in crisis.turn_note() and "do not ask" in crisis.turn_note()
    # The next turn still keeps help in view.
    crisis.observe_assistant_turn("شكراً إنك حكيتلي. اتصل على 911.")
    crisis.observe_user_turn("ما بدي أحكي لحدا")
    assert crisis.response_type.value == "feelings" and "911" in crisis.turn_note()

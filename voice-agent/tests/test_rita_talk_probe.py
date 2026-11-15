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


def test_free_talk_leads_with_a_question_and_a_phrase_but_not_in_a_lesson():
    import bot

    section = bot.free_talk_section({"mode": "free_conversation"}, {"name": "English", "code": "en"})
    assert "FREE CONVERSATION" in section and "English phrase" in section
    assert bot.free_talk_section({"mode": "free_conversation", "study": {"lessonId": "l1"}}, None) == ""
    assert bot.free_talk_section({"mode": "lesson"}, None) == ""


def test_a_phrase_in_quotes_is_not_counted_as_a_sentence():
    reply = 'حلو، فهمت إنك من الأردن. من وين تعلمت إنجليزي؟ "At school."'
    assert measure(reply)["sentences"] == 2
    assert check_turn(Turn("x", sheet="no"), reply) == []


def test_a_chat_turn_needs_a_question_and_a_phrase_to_answer_with():
    lead = Turn("x", sheet="no", lead=True)
    assert check_turn(lead, 'حلو! من وين إنت؟ "I\'m from …"') == []
    assert "a chat turn without a question and a phrase in quotes" in check_turn(lead, "حلو كثير.")


def test_a_right_sentence_is_not_corrected_and_a_wrong_one_is():
    right = Turn("I'm Abdulrahman", sheet="no", right=True)
    assert "corrected a sentence that was already right" in check_turn(right, 'صح: "I am Abdulrahman".')
    assert "corrected a sentence that was already right" in check_turn(right, 'الصح: "My name is Abdulrahman".')
    assert check_turn(right, 'حلو يا عبدالرحمن! من وين إنت؟ "I\'m from …"') == []
    wrong = Turn("I like play football", sheet="no", fix=("playing",))
    assert check_turn(wrong, 'الصح: "I like playing football".') == []
    assert any("not corrected" in p for p in check_turn(wrong, "حلو! شو كمان بتحب؟"))


def test_an_arabic_speaker_gets_arabic_words():
    assert "no Arabic for an Arabic speaker" in check_turn(Turn("x"), "Okay, ich höre jetzt auf.", "ar")
    assert check_turn(Turn("x"), "تمام.", "ar") == []
    assert check_turn(Turn("x"), "Okay.", "en") == []


def test_free_talk_gets_the_short_message_note_but_lessons_and_books_do_not():
    import bot
    from rita_state import RitaSessionState

    state = RitaSessionState(active_language="ar", active_dialect="ar-JO")
    state.observe_user_turn("مرحبا")
    free = bot.build_prompt({"mode": "free_conversation"}, state)
    assert "FREE TALK NOTE" in free
    # read last, after the free-conversation rules and right before the session's reply language
    assert free.index("FREE TALK NOTE") > free.index("FREE CONVERSATION")
    assert "FREE TALK NOTE" not in bot.build_prompt({"mode": "free_conversation", "study": {"lessonId": "l1"}}, state)
    assert "FREE TALK NOTE" not in bot.build_prompt({"mode": "lesson", "lesson": {"brief": "x"}}, state)


def test_an_explanation_in_free_talk_follows_the_short_note_not_the_long_one():
    import bot
    from rita_state import RitaSessionState

    state = RitaSessionState(active_language="ar", active_dialect="ar-JO")
    state.observe_user_turn("اشرحلي متى بستعمل am و is و are")
    prompt = bot.build_prompt({"mode": "free_conversation"}, state)
    assert "FREE TALK NOTE" in prompt
    assert "THE LEARNER ASKED FOR AN EXPLANATION" not in prompt


def test_a_question_inside_the_phrase_to_say_is_not_one_of_uzyras_questions():
    assert measure('أكيد، شو حابب تحكي بالألماني؟ "Wie geht es dir?"')["questions"] == 1


def test_a_named_place_and_a_reused_phrase_are_caught():
    from rita_talk_probe import repeated_phrase

    turn = Turn("شو أحسن مطعم؟", forbid=("مشهور",))
    assert any("must not" in p for p in check_turn(turn, 'مطعم "X" مشهور. شو بتحب تاكل؟ "Ich mag …"'))
    lead = Turn("I'm from Jordan", lead=True)
    assert repeated_phrase(lead, 'حلو! شو بتشتغل؟ "I work as …"', {"i like"}) == []
    assert repeated_phrase(lead, 'حلو! شو بتشتغل؟ "I like …"', {"i like"})
    assert repeated_phrase(lead, 'حلو! شو بتحب؟ "I\'m from Jordan"', set())

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rita_content_probe import (
    CASES,
    Case,
    case_prompt_and_options,
    check_reply,
    count_sentences,
    print_result,
)


def case(case_id):
    return next(item for item in CASES if item.id == case_id)


def test_the_known_wrong_german_rules_are_caught():
    bad = "In German, the noun after a preposition is always in the dative case."
    assert check_reply(case("dative-rule-en"), bad)
    good = "Some prepositions like mit and nach take the dative; others like für take the accusative."
    assert check_reply(case("dative-rule-en"), good) == []
    assert check_reply(case("hoffen-vs-helfen"), "Hoffen takes the dative, helfen takes the accusative.")
    assert check_reply(case("hoffen-vs-helfen"), "Helfen takes the dative. Hoffen goes with auf and the accusative.") == []


def test_a_numbered_list_or_a_forced_follow_up_is_caught():
    assert check_reply(case("no-list-in-speech"), "1. kochen 2. backen 3. braten")
    assert check_reply(case("no-list-in-speech"), "You can say kochen, backen, braten, schneiden and waschen.") == []
    assert check_reply(case("no-forced-follow-up"), "برلين. بدك أكمل؟")
    assert check_reply(case("no-forced-follow-up"), "عاصمة ألمانيا برلين.") == []


def test_the_reply_language_follows_the_site_choice():
    assert check_reply(case("how-to-say-english-reply"), 'You can say "Ich möchte eine Pizza bestellen".') == []
    assert check_reply(case("how-to-say-english-reply"), 'بنقول "Ich möchte eine Pizza bestellen". وبتستخدمها بالمطعم.')
    assert check_reply(case("how-to-say-arabic-reply"), 'بنقول "Ich möchte eine Pizza bestellen". وبتستخدمها بالمطعم.') == []
    assert check_reply(case("how-to-say-arabic-reply"), 'You can say "Ich möchte eine Pizza bestellen".')


def test_a_confused_learner_gets_no_grammar_terms_and_a_short_answer():
    assert check_reply(case("i-did-not-understand"), "خلّينا نشوفها هيك: الاسم بياخد شكل داتيف بعد mit.")
    assert check_reply(case("i-did-not-understand"), "تمام، خلّينا نجرب طريقة تانية. تخيل إنك بتعطي مفتاح لصاحبك: ich gebe dir den Schlüssel.") == []


def test_an_empty_reply_is_a_failure_and_sentences_are_counted():
    assert check_reply(case("complaint"), "   ") == ["empty reply"]
    assert count_sentences("One. Two! Three?") == 3
    assert count_sentences("") == 0


def test_every_case_builds_the_prompt_the_worker_would_send():
    for item in CASES:
        prompt, options, _ = case_prompt_and_options(item)
        assert "REPLY LANGUAGE" in prompt, item.id
        if item.site_language in {"ar", "en"}:
            assert f"REPLY LANGUAGE: {'ARABIC' if item.site_language == 'ar' else 'ENGLISH'}" in prompt, item.id
        assert options is None or options["max_completion_tokens"] > 450


def test_case_ids_are_unique():
    ids = [item.id for item in CASES]
    assert len(ids) == len(set(ids))
    assert all(isinstance(item, Case) for item in CASES)


def test_structured_probe_result_prints_without_exposing_secret(capsys):
    failed = print_result(
        {
            "outcome": "failed",
            "passed": 1,
            "failed": 1,
            "total": 2,
            "cases": [
                {"id": "good", "passed": True, "problems": []},
                {
                    "id": "bad",
                    "passed": False,
                    "problems": ["wrong language"],
                    "reply_preview": "synthetic reply",
                },
            ],
        }
    )
    output = capsys.readouterr().out
    assert failed == 1
    assert "PASS good" in output
    assert "FAIL bad" in output
    assert "1 of 2 cases passed" in output

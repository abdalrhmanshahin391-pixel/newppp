from rita_turn_policy import adaptive_unpunctuated_secs


def test_short_complete_turns_keep_a_fast_bound():
    assert adaptive_unpunctuated_secs("كيف حالك اليوم", 0.9) == 0.45


def test_longer_turns_get_only_bounded_extra_room():
    assert adaptive_unpunctuated_secs("واحد اثنين ثلاثة اربعة خمسة ستة", 0.9) == 0.65
    assert adaptive_unpunctuated_secs(
        "واحد اثنين ثلاثة اربعة خمسة ستة سبعة ثمانية تسعة عشرة احد عشر", 0.9
    ) == 0.85


def test_operator_can_still_choose_a_lower_delay():
    assert adaptive_unpunctuated_secs("واحد اثنين ثلاثة اربعة خمسة ستة", 0.4) == 0.4


from rita_turn_policy import (
    DEFAULT_PERIOD_COMMIT_SECS,
    bounded_wait_secs,
    period_commit_secs,
)

QUICK = 0.3


def test_questions_and_exclamations_keep_the_quick_wait():
    assert bounded_wait_secs("Hey, how are you?", QUICK, DEFAULT_PERIOD_COMMIT_SECS) == QUICK
    assert bounded_wait_secs("شو معنى صباح الخير؟", QUICK, DEFAULT_PERIOD_COMMIT_SECS) == QUICK
    assert bounded_wait_secs("Genau!", QUICK, DEFAULT_PERIOD_COMMIT_SECS) == QUICK


def test_one_word_commands_stay_fast():
    for text in ("Stop.", "وقفي.", "خلص."):
        assert bounded_wait_secs(text, QUICK, DEFAULT_PERIOD_COMMIT_SECS) == QUICK


def test_a_sentence_ending_on_a_breath_stop_waits_longer():
    for text in (
        "أعطيني مجموعة.",
        "يعني أنا حاب نحكي.",
        "سو لما أحكي معك بالإنجليزي.",
        "I want to practise ordering food.",
    ):
        assert bounded_wait_secs(text, QUICK, DEFAULT_PERIOD_COMMIT_SECS) == DEFAULT_PERIOD_COMMIT_SECS


def test_the_period_wait_can_be_turned_off_to_get_the_old_behaviour_back():
    assert bounded_wait_secs("أعطيني مجموعة.", QUICK, 0) == QUICK
    assert period_commit_secs({"periodCommitSecs": 0}) == 0.0


def test_a_learner_who_searches_for_words_gets_a_little_more_time():
    base = bounded_wait_secs("أعطيني مجموعة.", QUICK, 0.9, 0)
    slow = bounded_wait_secs("أعطيني مجموعة.", QUICK, 0.9, 2)
    assert slow > base


def test_period_wait_setting_is_clamped_and_forgiving():
    assert period_commit_secs({}) == DEFAULT_PERIOD_COMMIT_SECS
    assert period_commit_secs({"periodCommitSecs": "abc"}) == DEFAULT_PERIOD_COMMIT_SECS
    assert period_commit_secs({"periodCommitSecs": 0.1}) == 0.5
    assert period_commit_secs({"periodCommitSecs": 9}) == 1.4

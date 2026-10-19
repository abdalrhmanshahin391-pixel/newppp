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

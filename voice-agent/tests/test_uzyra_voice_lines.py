"""The study circle's recorded lines: one pair per circle action, short, and gender-neutral."""

import re

from uzyra_voice_lines import LINES, line_files

ACTIONS = {
    "make_cards", "make_mcq", "explain", "meaning", "word_by_word", "why_form",
    "compare_arabic", "simplify", "common_mistake", "summarize_section", "explain_reply", "report",
}


def test_every_circle_action_has_two_lines():
    assert set(LINES) == ACTIONS
    assert all(len(texts) == 2 for texts in LINES.values())


def test_lines_are_short_and_never_name_the_learner_by_gender():
    for texts in LINES.values():
        for text in texts:
            assert len(text.split()) <= 7, text
            # No second-person endings or commands that need a masculine or feminine form.
            assert not re.search(r"(لك|لِك|كِ|ي\b.*صحح|انتبه|تفضّل|جرّب|قول)", text), text


def test_file_names_are_stable():
    names = [name for name, _ in line_files()]
    assert len(names) == len(set(names)) == 24
    assert names[0] == "make_cards-1.mp3"

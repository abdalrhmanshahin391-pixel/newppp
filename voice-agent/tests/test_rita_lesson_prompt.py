import ast
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_lesson_section():
    tree = ast.parse((ROOT / "bot.py").read_text(encoding="utf-8"))
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "lesson_section")
    namespace: dict[str, Any] = {"Any": Any}
    exec(compile(ast.Module(body=[node], type_ignores=[]), "bot.py", "exec"), namespace)
    return namespace["lesson_section"]


def test_lesson_notes_reach_the_prompt():
    lesson_section = load_lesson_section()
    text = lesson_section({"lesson": {"id": "x", "title": "to be", "brief": "Lesson: The verb to be"}})
    assert "CURRICULUM LESSON" in text
    assert "Lesson: The verb to be" in text
    assert "never read them aloud" in text


def test_free_conversation_has_no_lesson_section():
    lesson_section = load_lesson_section()
    assert lesson_section({}) == ""
    assert lesson_section({"lesson": "not a dict"}) == ""
    assert lesson_section({"lesson": {"brief": "   "}}) == ""


def test_lesson_brief_is_capped():
    lesson_section = load_lesson_section()
    text = lesson_section({"lesson": {"brief": "a" * 9000}})
    assert text.count("a") < 4200


def test_build_prompt_includes_lesson_section():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert "{lesson_section(body)}" in source

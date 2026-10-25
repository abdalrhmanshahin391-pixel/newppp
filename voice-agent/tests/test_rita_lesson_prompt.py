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
    assert "{lesson_engine_section(body, lesson_voice) or lesson_section(body)}" in source


def load_opening():
    tree = ast.parse((ROOT / "bot.py").read_text(encoding="utf-8"))
    names = {"lesson_section", "opens_lesson", "opening_message"}
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    from rita_lesson_voice import lesson_engine_enabled

    namespace: dict[str, Any] = {"Any": Any, "lesson_engine_enabled": lesson_engine_enabled}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "bot.py", "exec"), namespace)
    return namespace["opening_message"], namespace["lesson_section"]


def test_a_lesson_does_not_open_with_the_free_conversation_question():
    opening_message, _ = load_opening()
    message = opening_message({"lesson": {"brief": "Lesson: The verb to be"}})
    assert message["role"] == "system"
    assert "practise" not in message["content"]


def test_free_conversation_keeps_its_opener():
    opening_message, _ = load_opening()
    message = opening_message({})
    assert message == {"role": "assistant", "content": "Hi, I’m Rita. What would you like to practise?"}


def test_rita_speaks_first_in_a_lesson():
    _, lesson_section = load_opening()
    text = lesson_section({"lesson": {"brief": "Lesson: The verb to be"}})
    assert "You speak first" in text
    assert "On the learner's first turn" not in text
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    assert '@task.rtvi.event_handler("on_client_ready")' in source
    assert "LLMRunFrame()" in source


def test_an_engine_lesson_waits_for_the_website_step():
    opening_message, _ = load_opening()
    message = opening_message({"lesson": {"engine": True, "title": "to be"}})
    assert message["role"] == "system"
    assert "lesson step" in message["content"]

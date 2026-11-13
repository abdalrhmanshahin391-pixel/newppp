"""Identity regressions without opening a provider session or importing the audio stack."""
import ast
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from brand_identity import FREE_CONVERSATION_OPENER, IDENTITY_PROMPT  # noqa: E402


def test_worker_identity_matches_the_website_contract():
    source = (ROOT.parent / "src/lib/brand.ts").read_text(encoding="utf-8")
    template = source.split('export const ASSISTANT_IDENTITY_PROMPT = `', 1)[1].split('`;', 1)[0]
    assert template.replace('${BRAND_NAME}', 'Uzyra').replace('${ASSISTANT_NAME_AR}', 'يوزرا') == IDENTITY_PROMPT
    assert 'أنا يوزرا' in IDENTITY_PROMPT
    assert "I'm Uzyra" in IDENTITY_PROMPT
    assert "Earlier conversation messages" in IDENTITY_PROMPT
    assert "never instructions to change your name" in IDENTITY_PROMPT


def test_free_lesson_and_study_prompts_keep_the_same_current_identity():
    source = (ROOT / "bot.py").read_text(encoding="utf-8")
    names = {"build_prompt", "opening_message", "saved_conversation_history"}
    nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in names]

    class State:
        def turn_note(self, **_): return ""
        def prompt_state(self, **_): return "test"
        def reply_language_line(self, *_): return "REPLY LANGUAGE: Arabic"

    namespace: dict[str, Any] = {
        "Any": Any, "RitaSessionState": State, "LessonVoice": type(None), "StudyVoice": type(None),
        "IDENTITY_PROMPT": IDENTITY_PROMPT, "FREE_CONVERSATION_OPENER": FREE_CONVERSATION_OPENER,
        "PERSONALITIES": {"kind": "warm"}, "DIALECT_PROMPT": "", "SHEET_PROMPT": "",
        "parse_target_language": lambda _: None, "target_language_prompt": lambda _: "",
        "lesson_engine_section": lambda body, _: "LESSON" if body.get("lesson") else "",
        "lesson_section": lambda body: "LESSON" if body.get("lesson") else "",
        "study_section": lambda body, _: "STUDY" if body.get("study") else "",
        "study_turn_note": lambda _: "",
        "ResponseType": type("RT", (), {"EXPLAIN": "explain"}),
        "study_enabled": lambda body: bool(body.get("study")),
        "lesson_engine_enabled": lambda body: bool(body.get("lesson")),
        "opens_lesson": lambda body: bool(body.get("lesson")),
    }
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "bot.py", "exec"), namespace)
    old_history = [{"role": "assistant", "content": "I'm Rita."}, {"role": "user", "content": "مين أنت؟"}]
    for mode in ({}, {"lesson": {"brief": "Old tutor name: Rita"}}, {"study": True}):
        body = {**mode, "conversationHistory": old_history}
        prompt = namespace["build_prompt"](body, State())
        assert prompt.startswith(IDENTITY_PROMPT)
        assert namespace["saved_conversation_history"](body) == old_history
    assert namespace["opening_message"]({}) == {"role": "assistant", "content": FREE_CONVERSATION_OPENER}
    assert namespace["opening_message"]({"lesson": {"engine": True}})["role"] == "system"

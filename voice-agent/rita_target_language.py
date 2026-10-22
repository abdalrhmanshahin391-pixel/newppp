"""The language a learner has chosen to learn, as sent by the website when a session starts.

The website resolves it from the learner's account (or the conversation's own language) and checks
it against its list of languages, so this module only validates the shape and turns it into the
two things the worker needs: the speech-recognition hints and one short block of the prompt.
"""

from __future__ import annotations

import re
from typing import Any, TypedDict

_CODE = re.compile(r"^[a-z]{2,3}(-[a-z0-9]{2,8})?$")
# Letters, digits, spaces and a few name punctuation marks; nothing that could read as an instruction.
_NAME = re.compile(r"^[\w .'()\-]+$")
_LEGACY_HINTS = ("ar", "de", "en")


class TargetLanguage(TypedDict):
    code: str
    name: str
    speech_code: str


def parse_target_language(body: dict[str, Any]) -> TargetLanguage | None:
    """The validated target language from the session request, or None when there is none."""
    raw = body.get("targetLanguage")
    if not isinstance(raw, dict):
        return None
    code = str(raw.get("code") or "").strip().lower()
    speech_code = str(raw.get("speechCode") or code).strip().lower()
    name = " ".join(str(raw.get("name") or "").split())[:60]
    if not _CODE.match(code) or not _CODE.match(speech_code) or not name:
        return None
    if not _NAME.match(name):
        return None
    return {"code": code, "name": name, "speech_code": speech_code}


def stt_language_codes(target: TargetLanguage | None) -> list[str]:
    """Languages to listen for: Arabic (the learner explains in it), the target, and English."""
    if target is None:
        return list(_LEGACY_HINTS)
    codes: list[str] = []
    for code in ("ar", target["speech_code"], "en"):
        if code not in codes:
            codes.append(code)
    return codes


def target_language_prompt(target: TargetLanguage | None) -> str:
    """A prompt block for the learner's target language ('' when none, so the prompt is unchanged)."""
    if target is None:
        return ""
    name = target["name"]
    return (
        "\n\nLEARNING TARGET\n"
        f"- This learner is learning {name} ({target['code']}). Teach words, sentences and "
        f"corrections in {name}.\n"
        "- Explanations follow the REPLY LANGUAGE line at the end of this prompt (Jordanian Arabic "
        "unless the learner asked for another language). Do not teach another language unless the "
        "learner asks.\n"
        f"- Whatever the reply language is, the example and the phrase being practised stay in {name}."
    )

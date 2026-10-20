"""Regression checks for provider names used while constructing Rita's pipeline."""

import ast
from pathlib import Path


def test_groq_settings_provider_is_imported() -> None:
    """The Modal worker must not crash after Daily has already connected."""

    source = Path(__file__).parents[1].joinpath("bot.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported_names = {
        alias.asname or alias.name
        for node in ast.walk(tree)
        if isinstance(node, (ast.Import, ast.ImportFrom))
        for alias in node.names
    }

    assert "GroqLLMService" in imported_names

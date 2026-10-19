from types import SimpleNamespace

from rita_groq_llm import finish_reason_name


def test_finish_reason_is_read_without_response_text():
    chunk = SimpleNamespace(
        choices=[SimpleNamespace(finish_reason="length", delta=SimpleNamespace(content="private"))]
    )
    assert finish_reason_name(chunk) == "length"


def test_non_terminal_chunk_has_no_finish_reason():
    chunk = SimpleNamespace(choices=[SimpleNamespace(finish_reason=None)])
    assert finish_reason_name(chunk) is None

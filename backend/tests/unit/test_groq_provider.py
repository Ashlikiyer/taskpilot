"""GroqProvider without the network: the SDK client is replaced by a small stand-in."""

from types import SimpleNamespace
from typing import Any

import groq
import httpx
import pytest

from app.services.ai.provider import GroqProvider, Message, ProviderError


class StubCompletions:
    def __init__(self, result: Any) -> None:
        self.result = result
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def _provider(model: str, result: Any) -> tuple[GroqProvider, StubCompletions]:
    provider = GroqProvider(api_key="test-key", model=model, timeout=5)
    completions = StubCompletions(result)
    provider._client = SimpleNamespace(  # type: ignore[assignment]
        chat=SimpleNamespace(completions=completions)
    )
    return provider, completions


def _response(text: str) -> Any:
    return SimpleNamespace(
        model="openai/gpt-oss-20b",
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(prompt_tokens=120, completion_tokens=30),
    )


async def test_missing_key_is_a_provider_error() -> None:
    provider = GroqProvider(api_key=None, model="openai/gpt-oss-20b", timeout=5)

    with pytest.raises(ProviderError, match="GROQ_API_KEY"):
        await provider.complete_json("system", [Message("user", "hi")])


async def test_sends_json_mode_and_reads_usage() -> None:
    provider, completions = _provider("openai/gpt-oss-20b", _response('{"ok": true}'))

    completion = await provider.complete_json(
        "system prompt", [Message("user", "hi"), Message("assistant", "{}")]
    )

    assert completion.text == '{"ok": true}'
    assert (completion.input_tokens, completion.output_tokens) == (120, 30)
    assert completions.kwargs["response_format"] == {"type": "json_object"}
    assert completions.kwargs["reasoning_effort"] == "low"
    assert [m["role"] for m in completions.kwargs["messages"]] == ["system", "user", "assistant"]


async def test_non_reasoning_models_skip_reasoning_effort() -> None:
    provider, completions = _provider("qwen/qwen3.8-27b", _response("{}"))

    await provider.complete_json("system", [Message("user", "hi")])

    assert completions.kwargs["reasoning_effort"] is groq.omit


async def test_groq_errors_become_provider_errors() -> None:
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    provider, _ = _provider("openai/gpt-oss-20b", groq.APITimeoutError(request=request))

    with pytest.raises(ProviderError):
        await provider.complete_json("system", [Message("user", "hi")])

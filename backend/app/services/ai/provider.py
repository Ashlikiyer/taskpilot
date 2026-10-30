"""The provider interface every AI feature calls, and its Groq implementation.

Swapping Groq for another model means writing one more class with `complete_json`.
"""

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol

import groq
from groq import AsyncGroq, omit
from groq.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Message:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class Completion:
    text: str
    model: str
    input_tokens: int
    output_tokens: int


def _system(content: str) -> ChatCompletionSystemMessageParam:
    return {"role": "system", "content": content}


def _message(message: Message) -> ChatCompletionMessageParam:
    if message.role == "assistant":
        return ChatCompletionAssistantMessageParam(role="assistant", content=message.content)
    return ChatCompletionUserMessageParam(role="user", content=message.content)


class ProviderError(Exception):
    """The provider could not answer (no key, network, rate limit, server error)."""


class AIProvider(Protocol):
    model: str

    async def complete_json(self, system: str, messages: list[Message]) -> Completion:
        """Return the model's reply, which the caller expects to be a JSON object."""
        ...


class GroqProvider:
    def __init__(self, api_key: str | None, model: str, timeout: float) -> None:
        self.model = model
        self._client = (
            AsyncGroq(api_key=api_key, timeout=timeout, max_retries=1) if api_key else None
        )

    async def complete_json(self, system: str, messages: list[Message]) -> Completion:
        if self._client is None:
            raise ProviderError("GROQ_API_KEY is not configured")
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[_system(system), *(_message(m) for m in messages)],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_completion_tokens=1024,
                # gpt-oss models think before answering; small tasks need little of that.
                reasoning_effort="low" if self.model.startswith("openai/gpt-oss") else omit,
            )
        except groq.APIError as exc:
            logger.warning("Groq request failed: %s", type(exc).__name__)
            raise ProviderError(str(exc)) from exc

        usage = response.usage
        return Completion(
            text=response.choices[0].message.content or "",
            model=response.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )


class EchoProvider:
    """Offline stand-in for the browser test: a quick-add request comes back as a
    draft with that text as its title. Other features get no usable answer."""

    model = "echo"

    async def complete_json(self, system: str, messages: list[Message]) -> Completion:
        try:
            request = json.loads(messages[0].content).get("REQUEST", "")
        except ValueError, AttributeError, IndexError:
            request = ""
        text = json.dumps({"title": str(request)[:200]} if request else {})
        return Completion(text=text, model=self.model, input_tokens=0, output_tokens=0)


@lru_cache
def get_provider() -> AIProvider:
    settings = get_settings()
    if settings.ai_provider == "echo":
        return EchoProvider()
    key = settings.groq_api_key.get_secret_value() if settings.groq_api_key else None
    return GroqProvider(api_key=key, model=settings.ai_model, timeout=settings.ai_timeout_seconds)

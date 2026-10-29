"""A stand-in AI provider: fixed replies, no network, no cost, same result every run."""

import json
from dataclasses import dataclass, field
from typing import Any

from app.services.ai.provider import Completion, Message, ProviderError


@dataclass
class Call:
    system: str
    messages: list[Message]


@dataclass
class FakeProvider:
    """Returns queued replies in order. A reply may be a dict (sent as JSON), a raw
    string (to simulate malformed output) or an exception to raise."""

    replies: list[dict[str, Any] | str | Exception] = field(default_factory=list)
    calls: list[Call] = field(default_factory=list)
    model: str = "fake-model"

    def reply(self, *replies: dict[str, Any] | str | Exception) -> FakeProvider:
        self.replies.extend(replies)
        return self

    async def complete_json(self, system: str, messages: list[Message]) -> Completion:
        self.calls.append(Call(system, list(messages)))
        if not self.replies:
            raise ProviderError("FakeProvider has no reply queued")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        text = reply if isinstance(reply, str) else json.dumps(reply)
        return Completion(text=text, model=self.model, input_tokens=100, output_tokens=20)

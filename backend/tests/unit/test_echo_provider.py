import json

from app.services.ai.provider import EchoProvider, Message


async def test_echo_turns_the_quick_add_request_into_the_title() -> None:
    prompt = json.dumps({"TODAY": "2026-10-30", "REQUEST": "Send the Acme invoice"})

    completion = await EchoProvider().complete_json("system", [Message("user", prompt)])

    assert json.loads(completion.text) == {"title": "Send the Acme invoice"}


async def test_echo_gives_other_prompts_an_empty_answer() -> None:
    completion = await EchoProvider().complete_json("system", [Message("user", "not json")])

    assert json.loads(completion.text) == {}

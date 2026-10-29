import uuid

from app.services.mentions import excerpt, mentioned_user_ids, to_plain_text

MARK = uuid.UUID("11111111-1111-1111-1111-111111111111")
ANA = uuid.UUID("22222222-2222-2222-2222-222222222222")


def test_finds_mentions_by_id() -> None:
    body = f"Hi @[Mark Santos]({MARK}) and @[Ana]({ANA}), see @[Mark]({MARK}) again"
    assert mentioned_user_ids(body) == {MARK, ANA}


def test_ignores_plain_at_signs_and_broken_mentions() -> None:
    body = "email me@example.com, @Mark, @[Mark](not-a-uuid), @[](1111)"
    assert mentioned_user_ids(body) == set()


def test_ignores_malformed_uuid_of_the_right_length() -> None:
    assert mentioned_user_ids("@[X](------------------------------------)") == set()


def test_plain_text_and_excerpt() -> None:
    body = f"Thanks @[Mark Santos]({MARK})!\n\nShipping   today."
    assert to_plain_text(body) == "Thanks @Mark Santos!\n\nShipping   today."
    assert excerpt(body) == "Thanks @Mark Santos! Shipping today."
    assert excerpt("x" * 200, length=10) == "xxxxxxxxx…"

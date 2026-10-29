import pytest
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import AIUsage, User
from app.services.ai.provider import ProviderError
from app.services.ai.runner import run_json
from tests.factories import create_user
from tests.fakes import FakeProvider


class Answer(BaseModel):
    summary: str


async def _run(db: AsyncSession, user: User, provider: FakeProvider) -> Answer:
    return await run_json(
        db,
        provider,
        user=user,
        workspace_id=None,
        feature="test",
        system="system prompt",
        prompt="question",
        schema=Answer,
    )


async def _usage(db: AsyncSession) -> list[tuple[str, bool]]:
    rows = (await db.execute(select(AIUsage).order_by(AIUsage.created_at))).scalars()
    return [(row.feature, row.success) for row in rows]


async def test_valid_reply_is_parsed_and_logged(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    provider = FakeProvider().reply({"summary": "ok"})

    answer = await _run(db_session, user, provider)

    assert answer == Answer(summary="ok")
    assert await _usage(db_session) == [("test", True)]


async def test_invalid_json_is_retried_once_with_the_error(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    provider = FakeProvider().reply("not json at all", {"summary": "fixed"})

    answer = await _run(db_session, user, provider)

    assert answer.summary == "fixed"
    retry = provider.calls[1].messages
    assert [m.role for m in retry] == ["user", "assistant", "user"]
    assert "did not match the schema" in retry[2].content
    assert await _usage(db_session) == [("test", False), ("test", True)]


async def test_two_bad_replies_give_ai_unavailable(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    provider = FakeProvider().reply({"wrong": 1}, "{broken")

    with pytest.raises(AppError) as error:
        await _run(db_session, user, provider)

    assert (error.value.status_code, error.value.code) == (502, "AI_UNAVAILABLE")
    assert len(provider.calls) == 2


async def test_provider_failure_gives_ai_unavailable_and_is_logged(
    db_session: AsyncSession,
) -> None:
    user = await create_user(db_session)
    provider = FakeProvider().reply(ProviderError("timeout"))

    with pytest.raises(AppError) as error:
        await _run(db_session, user, provider)

    assert error.value.code == "AI_UNAVAILABLE"
    assert await _usage(db_session) == [("test", False)]


async def test_daily_limit_blocks_the_51st_call(db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    db_session.add_all(
        AIUsage(user_id=user.id, feature="test", model="m", success=True) for _ in range(50)
    )
    await db_session.flush()
    provider = FakeProvider().reply({"summary": "never sent"})

    with pytest.raises(AppError) as error:
        await _run(db_session, user, provider)

    assert (error.value.status_code, error.value.code) == (429, "AI_DAILY_LIMIT")
    assert provider.calls == []

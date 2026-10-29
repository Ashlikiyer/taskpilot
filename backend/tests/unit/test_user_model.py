import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


async def test_user_defaults_timezone_to_manila(db_session: AsyncSession) -> None:
    user = User(email="ana@example.com", name="Ana", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)

    assert user.timezone == "Asia/Manila"
    assert user.created_at is not None


async def test_user_email_must_be_lowercase(db_session: AsyncSession) -> None:
    db_session.add(User(email="Ana@Example.com", name="Ana", password_hash="x"))

    with pytest.raises(IntegrityError, match="ck_users_email_lowercase"):
        await db_session.flush()

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ConflictError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.db.models import User
from app.repositories import refresh_tokens as refresh_repo
from app.repositories import users as users_repo
from app.schemas.auth import RegisterRequest


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str


_EMAIL_TAKEN = "An account with this email already exists"


def _invalid_refresh() -> AppError:
    return AppError(401, "UNAUTHENTICATED", "Session expired, please log in again")


async def register(db: AsyncSession, data: RegisterRequest) -> User:
    if await users_repo.get_by_email(db, data.email):
        raise ConflictError(_EMAIL_TAKEN)
    try:
        user = await users_repo.create(
            db, email=data.email, name=data.name, password_hash=hash_password(data.password)
        )
        await db.commit()
    except IntegrityError as exc:  # two registrations racing for the same email
        await db.rollback()
        raise ConflictError(_EMAIL_TAKEN) from exc
    return user


async def _issue_tokens(db: AsyncSession, user: User, now: datetime) -> IssuedTokens:
    raw, token_hash = new_opaque_token()
    await refresh_repo.create(
        db,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=now + timedelta(days=get_settings().refresh_token_days),
    )
    return IssuedTokens(access_token=create_access_token(user.id, now=now), refresh_token=raw)


async def login(db: AsyncSession, email: str, password: str) -> IssuedTokens:
    user = await users_repo.get_by_email(db, email)
    password_ok = verify_password(password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise AppError(401, "UNAUTHENTICATED", "Invalid email or password")
    tokens = await _issue_tokens(db, user, datetime.now(UTC))
    await db.commit()
    return tokens


async def refresh(db: AsyncSession, raw_token: str | None) -> IssuedTokens:
    """Rotate a refresh token. Reusing a revoked token revokes all of the user's tokens."""
    if not raw_token:
        raise _invalid_refresh()
    now = datetime.now(UTC)
    token = await refresh_repo.get_by_hash(db, hash_token(raw_token))
    if token is None:
        raise _invalid_refresh()
    if token.revoked_at is not None:
        await refresh_repo.revoke_all_for_user(db, token.user_id, now)
        await db.commit()
        raise _invalid_refresh()
    user = await users_repo.get_by_id(db, token.user_id)
    if token.expires_at <= now or user is None:
        raise _invalid_refresh()

    await refresh_repo.revoke(db, token, now)
    tokens = await _issue_tokens(db, user, now)
    await db.commit()
    return tokens


async def logout(db: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    token = await refresh_repo.get_by_hash(db, hash_token(raw_token))
    if token is not None and token.revoked_at is None:
        await refresh_repo.revoke(db, token, datetime.now(UTC))
        await db.commit()

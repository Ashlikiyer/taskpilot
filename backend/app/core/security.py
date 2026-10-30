"""Password hashing, JWT access tokens and opaque (refresh/invite) tokens."""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pydantic import SecretStr

from app.core.config import get_settings
from app.core.errors import AppError

JWT_ALGORITHM = "HS256"

_password_hash = PasswordHash((Argon2Hasher(),))
# Verified when the email is unknown, so login takes the same time either way.
_DUMMY_HASH = _password_hash.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _password_hash.verify(password, _DUMMY_HASH)
        return False
    return _password_hash.verify(password, password_hash)


def create_access_token(user_id: uuid.UUID, *, now: datetime | None = None) -> str:
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    """Return the user id in a valid access token, or raise a 401 AppError."""
    try:
        payload = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AppError(401, "TOKEN_EXPIRED", "Access token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AppError(401, "UNAUTHENTICATED", "Invalid access token") from exc
    if payload["type"] != "access":
        raise AppError(401, "UNAUTHENTICATED", "Invalid access token")
    try:
        return uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise AppError(401, "UNAUTHENTICATED", "Invalid access token") from exc


def new_opaque_token() -> tuple[str, str]:
    """Return (raw token for the client, SHA-256 hash for the database)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def secrets_match(given: str | None, expected: SecretStr | None) -> bool:
    """Compare a shared-secret header in constant time. An unset secret never matches,
    so an endpoint stays closed until it is configured."""
    if expected is None or given is None:
        return False
    return hmac.compare_digest(given.encode(), expected.get_secret_value().encode())

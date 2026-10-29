from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.security import create_access_token
from tests.factories import DEFAULT_PASSWORD, create_user

REFRESH_PATH = "/api/v1/auth"


def _use_refresh_cookie(client: AsyncClient, value: str) -> None:
    client.cookies.clear()
    client.cookies.set("refresh_token", value, domain="test.local", path=REFRESH_PATH)


async def _login(client: AsyncClient, email: str = "ana@example.com") -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.cookies["refresh_token"]


async def test_register_creates_user_with_lowercase_email(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": " Ana Santos ", "email": "Ana@Example.com", "password": "long-enough"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ana@example.com"
    assert body["name"] == "Ana Santos"
    assert "password_hash" not in body


async def test_register_rejects_duplicate_email(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="ana@example.com")

    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Ana", "email": "ANA@example.com", "password": "long-enough"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


async def test_register_rejects_short_password(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={"name": "Ana", "email": "ana@example.com", "password": "short"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_login_returns_access_token_and_sets_refresh_cookie(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)

    response = await client.post(
        "/api/v1/auth/login", json={"email": "ANA@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie
    assert f"path={REFRESH_PATH}" in cookie

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"


async def test_login_with_wrong_password_fails(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)

    response = await client.post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"
    assert "refresh_token" not in response.cookies


async def test_login_with_unknown_email_fails_the_same_way(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["message"] == "Invalid email or password"


async def test_me_requires_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_expired_access_token_returns_token_expired(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await create_user(db_session)
    expired = create_access_token(user.id, now=datetime.now(UTC) - timedelta(hours=1))

    response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_tampered_access_token_is_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await create_user(db_session)
    token = create_access_token(user.id)

    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token[:-2]}xx"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_refresh_rotates_the_refresh_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    first = await _login(client)
    _use_refresh_cookie(client, first)

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.cookies["refresh_token"] != first


async def test_reusing_a_rotated_refresh_token_revokes_all_sessions(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    first = await _login(client)
    _use_refresh_cookie(client, first)
    second = (await client.post("/api/v1/auth/refresh")).cookies["refresh_token"]

    _use_refresh_cookie(client, first)
    reuse = await client.post("/api/v1/auth/refresh")
    assert reuse.status_code == 401

    # The legitimately rotated token was revoked too.
    _use_refresh_cookie(client, second)
    after = await client.post("/api/v1/auth/refresh")
    assert after.status_code == 401


async def test_refresh_without_cookie_fails(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_logout_revokes_the_refresh_token(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session)
    token = await _login(client)
    _use_refresh_cookie(client, token)

    logout = await client.post("/api/v1/auth/logout")
    assert logout.status_code == 204

    _use_refresh_cookie(client, token)
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


async def test_login_is_rate_limited(client: AsyncClient) -> None:
    limiter.enabled = True
    limiter.reset()
    try:
        statuses = [
            (
                await client.post(
                    "/api/v1/auth/login", json={"email": "x@example.com", "password": "nope-nope"}
                )
            ).status_code
            for _ in range(6)
        ]
    finally:
        limiter.enabled = False
        limiter.reset()

    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429

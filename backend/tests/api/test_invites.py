from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import new_opaque_token
from app.db.models import MemberRole, User, Workspace
from app.repositories import invites as invites_repo
from tests.factories import add_member, auth_headers, create_user, create_workspace


async def _invite(
    client: AsyncClient, workspace: Workspace, by: User, email: str, role: str = "member"
) -> str:
    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/invites",
        json={"email": email, "role": role},
        headers=auth_headers(by),
    )
    assert response.status_code == 201, response.text
    return str(response.json()["invite_url"]).rsplit("/", 1)[1]


async def test_admin_invite_returns_a_link_valid_for_7_days(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/invites",
        json={"email": "New@Example.com", "role": "admin"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["role"] == "admin"
    assert body["invite_url"].startswith("http://localhost:3000/invite/")
    expires_at = datetime.fromisoformat(body["expires_at"])
    assert timedelta(days=6, hours=23) < expires_at - datetime.now(UTC) <= timedelta(days=7)


async def test_member_cannot_invite(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    member = await add_member(db_session, workspace, "member@example.com", MemberRole.member)

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/invites",
        json={"email": "new@example.com"},
        headers=auth_headers(member),
    )

    assert response.status_code == 403


async def test_inviting_an_existing_member_conflicts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    await add_member(db_session, workspace, "member@example.com", MemberRole.member)

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/invites",
        json={"email": "MEMBER@example.com"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 409


async def test_accepting_invite_joins_workspace_with_invited_role(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    token = await _invite(client, workspace, owner, "new@example.com", role="viewer")
    invitee = await create_user(db_session, email="new@example.com")

    response = await client.post(f"/api/v1/invites/{token}/accept", headers=auth_headers(invitee))

    assert response.status_code == 200
    assert response.json()["slug"] == "acme"
    assert response.json()["role"] == "viewer"


async def test_invite_cannot_be_used_twice(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    token = await _invite(client, workspace, owner, "new@example.com")
    invitee = await create_user(db_session, email="new@example.com")

    first = await client.post(f"/api/v1/invites/{token}/accept", headers=auth_headers(invitee))
    second = await client.post(f"/api/v1/invites/{token}/accept", headers=auth_headers(invitee))

    assert first.status_code == 200
    assert second.status_code == 404
    assert second.json()["error"]["code"] == "INVITE_NOT_FOUND"


async def test_invite_for_another_email_is_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    token = await _invite(client, workspace, owner, "new@example.com")
    stranger = await create_user(db_session, email="stranger@example.com")

    response = await client.post(f"/api/v1/invites/{token}/accept", headers=auth_headers(stranger))
    members = await client.get(
        f"/api/v1/workspaces/{workspace.id}/members", headers=auth_headers(owner)
    )

    assert response.status_code == 403
    assert len(members.json()) == 1


async def test_expired_invite_is_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    raw, token_hash = new_opaque_token()
    await invites_repo.create(
        db_session,
        workspace_id=workspace.id,
        email="new@example.com",
        role=MemberRole.member,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    )
    invitee = await create_user(db_session, email="new@example.com")

    response = await client.post(f"/api/v1/invites/{raw}/accept", headers=auth_headers(invitee))

    assert response.status_code == 404


async def test_accepting_requires_login(client: AsyncClient) -> None:
    response = await client.post("/api/v1/invites/some-token/accept")

    assert response.status_code == 401

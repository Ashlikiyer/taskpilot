from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole
from tests.factories import add_member, auth_headers, create_user, create_workspace


async def test_create_workspace_makes_creator_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await create_user(db_session)

    response = await client.post(
        "/api/v1/workspaces", json={"name": "Acme Website!"}, headers=auth_headers(user)
    )

    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "acme-website"
    assert body["role"] == "owner"
    assert body["owner_id"] == str(user.id)


async def test_workspace_slugs_stay_unique(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await create_user(db_session)
    headers = auth_headers(user)

    first = await client.post("/api/v1/workspaces", json={"name": "Acme"}, headers=headers)
    second = await client.post("/api/v1/workspaces", json={"name": "Acme"}, headers=headers)

    assert first.json()["slug"] == "acme"
    assert second.json()["slug"].startswith("acme-")


async def test_list_returns_only_my_workspaces_with_my_role(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    mine = await create_workspace(db_session, owner, name="Mine", slug="mine")
    await create_workspace(db_session, owner, name="Not Mine", slug="not-mine")
    viewer = await add_member(db_session, mine, "viewer@example.com", MemberRole.viewer)

    response = await client.get("/api/v1/workspaces", headers=auth_headers(viewer))

    assert response.status_code == 200
    assert [(w["slug"], w["role"]) for w in response.json()] == [("mine", "viewer")]


async def test_other_workspace_returns_404_not_403(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner_a = await create_user(db_session, email="a@example.com")
    owner_b = await create_user(db_session, email="b@example.com")
    workspace_b = await create_workspace(db_session, owner_b, slug="b")
    headers = auth_headers(owner_a)

    for path in (
        f"/api/v1/workspaces/{workspace_b.id}",
        f"/api/v1/workspaces/{workspace_b.id}/members",
    ):
        response = await client.get(path, headers=headers)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "WORKSPACE_NOT_FOUND"


async def test_member_cannot_rename_but_admin_can(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    member = await add_member(db_session, workspace, "member@example.com", MemberRole.member)
    admin = await add_member(db_session, workspace, "admin@example.com", MemberRole.admin)
    path = f"/api/v1/workspaces/{workspace.id}"

    denied = await client.patch(path, json={"name": "New"}, headers=auth_headers(member))
    allowed = await client.patch(path, json={"name": "New"}, headers=auth_headers(admin))

    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN"
    assert allowed.status_code == 200
    assert allowed.json()["name"] == "New"


async def test_only_owner_can_delete_workspace(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    admin = await add_member(db_session, workspace, "admin@example.com", MemberRole.admin)
    path = f"/api/v1/workspaces/{workspace.id}"

    denied = await client.delete(path, headers=auth_headers(admin))
    allowed = await client.delete(path, headers=auth_headers(owner))
    after = await client.get(path, headers=auth_headers(owner))

    assert denied.status_code == 403
    assert allowed.status_code == 204
    assert after.status_code == 404


async def test_members_list_shows_roles(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db_session, owner)
    viewer = await add_member(db_session, workspace, "viewer@example.com", MemberRole.viewer)

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/members", headers=auth_headers(viewer)
    )

    assert response.status_code == 200
    assert {(m["email"], m["role"]) for m in response.json()} == {
        ("owner@example.com", "owner"),
        ("viewer@example.com", "viewer"),
    }


async def test_admin_can_change_member_role(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    admin = await add_member(db_session, workspace, "admin@example.com", MemberRole.admin)
    member = await add_member(db_session, workspace, "member@example.com", MemberRole.member)

    response = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}",
        json={"role": "viewer"},
        headers=auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["role"] == "viewer"


async def test_admin_cannot_change_or_remove_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    admin = await add_member(db_session, workspace, "admin@example.com", MemberRole.admin)
    path = f"/api/v1/workspaces/{workspace.id}/members/{owner.id}"

    patch = await client.patch(path, json={"role": "member"}, headers=auth_headers(admin))
    delete = await client.delete(path, headers=auth_headers(admin))

    assert patch.status_code == 403
    assert delete.status_code == 403


async def test_owner_role_cannot_be_assigned(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    member = await add_member(db_session, workspace, "member@example.com", MemberRole.member)

    response = await client.patch(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}",
        json={"role": "owner"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 400


async def test_admin_can_remove_member_but_member_cannot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    member = await add_member(db_session, workspace, "member@example.com", MemberRole.member)
    other = await add_member(db_session, workspace, "other@example.com", MemberRole.member)
    path = f"/api/v1/workspaces/{workspace.id}/members/{other.id}"

    denied = await client.delete(path, headers=auth_headers(member))
    allowed = await client.delete(path, headers=auth_headers(owner))
    removed_user_view = await client.get(
        f"/api/v1/workspaces/{workspace.id}", headers=auth_headers(other)
    )

    assert denied.status_code == 403
    assert allowed.status_code == 204
    assert removed_user_view.status_code == 404

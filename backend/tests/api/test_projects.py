from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, User, Workspace
from tests.factories import add_member, auth_headers, create_user, create_workspace


async def _setup(db: AsyncSession) -> tuple[Workspace, User, User, User]:
    owner = await create_user(db, email="owner@example.com")
    workspace = await create_workspace(db, owner)
    member = await add_member(db, workspace, "member@example.com", MemberRole.member)
    viewer = await add_member(db, workspace, "viewer@example.com", MemberRole.viewer)
    return workspace, owner, member, viewer


async def _create(
    client: AsyncClient, workspace: Workspace, user: User, **fields: object
) -> dict[str, object]:
    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/projects",
        json={"name": "Website", **fields},
        headers=auth_headers(user),
    )
    assert response.status_code == 201, response.text
    body: dict[str, object] = response.json()
    return body


async def test_admin_creates_project_and_is_added_as_member(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, member, _ = await _setup(db_session)

    project = await _create(
        client,
        workspace,
        owner,
        name="  Acme Website ",
        description="Launch site",
        color="#22C55E",
        member_ids=[str(member.id)],
    )

    assert project["name"] == "Acme Website"
    assert project["color"] == "#22c55e"
    assert project["archived_at"] is None
    assert set(project["member_ids"]) == {str(owner.id), str(member.id)}  # type: ignore[arg-type]


async def test_blank_description_is_stored_as_null(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, _, _ = await _setup(db_session)

    project = await _create(client, workspace, owner, description="   ")

    assert project["description"] is None


async def test_member_and_viewer_cannot_create_projects(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, _, member, viewer = await _setup(db_session)

    for user in (member, viewer):
        response = await client.post(
            f"/api/v1/workspaces/{workspace.id}/projects",
            json={"name": "Nope"},
            headers=auth_headers(user),
        )
        assert response.status_code == 403


async def test_invalid_color_is_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner, _, _ = await _setup(db_session)

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/projects",
        json={"name": "Website", "color": "red"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 400


async def test_project_members_must_belong_to_workspace(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, _, _ = await _setup(db_session)
    outsider = await create_user(db_session, email="outsider@example.com")

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/projects",
        json={"name": "Website", "member_ids": [str(outsider.id)]},
        headers=auth_headers(owner),
    )

    assert response.status_code == 400
    assert response.json()["error"]["details"] == {"unknown_member_ids": [str(outsider.id)]}


async def test_viewer_can_list_and_get_projects(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, _, viewer = await _setup(db_session)
    project = await _create(client, workspace, owner)

    listing = await client.get(
        f"/api/v1/workspaces/{workspace.id}/projects", headers=auth_headers(viewer)
    )
    detail = await client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(viewer))

    assert [p["name"] for p in listing.json()] == ["Website"]
    assert detail.status_code == 200


async def test_other_workspace_project_returns_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, _, _ = await _setup(db_session)
    project = await _create(client, workspace, owner)
    stranger = await create_user(db_session, email="stranger@example.com")
    await create_workspace(db_session, stranger, slug="other")

    for method, path in [
        ("GET", f"/api/v1/projects/{project['id']}"),
        ("PATCH", f"/api/v1/projects/{project['id']}"),
        ("POST", f"/api/v1/projects/{project['id']}/archive"),
    ]:
        response = await client.request(
            method, path, json={"name": "x"}, headers=auth_headers(stranger)
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PROJECT_NOT_FOUND"


async def test_admin_updates_only_sent_fields(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, member, _ = await _setup(db_session)
    project = await _create(client, workspace, owner, description="Keep me", color="#ef4444")

    response = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Renamed", "member_ids": [str(member.id)]},
        headers=auth_headers(owner),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["name"] == "Renamed"
    assert body["description"] == "Keep me"
    assert body["color"] == "#ef4444"
    assert body["member_ids"] == [str(member.id)]


async def test_description_can_be_cleared(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner, _, _ = await _setup(db_session)
    project = await _create(client, workspace, owner, description="Old")

    response = await client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"description": None},
        headers=auth_headers(owner),
    )

    assert response.json()["description"] is None


async def test_member_cannot_edit_or_archive(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner, member, _ = await _setup(db_session)
    project = await _create(client, workspace, owner)
    headers = auth_headers(member)

    patch = await client.patch(
        f"/api/v1/projects/{project['id']}", json={"name": "x"}, headers=headers
    )
    archive = await client.post(f"/api/v1/projects/{project['id']}/archive", headers=headers)

    assert patch.status_code == 403
    assert archive.status_code == 403


async def test_archive_hides_project_until_restored(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, _, _ = await _setup(db_session)
    project = await _create(client, workspace, owner)
    headers = auth_headers(owner)
    list_path = f"/api/v1/workspaces/{workspace.id}/projects"

    archived = await client.post(f"/api/v1/projects/{project['id']}/archive", headers=headers)
    active = await client.get(list_path, headers=headers)
    everything = await client.get(f"{list_path}?include_archived=true", headers=headers)
    still_readable = await client.get(f"/api/v1/projects/{project['id']}", headers=headers)

    assert archived.json()["archived_at"] is not None
    assert active.json() == []
    assert [p["id"] for p in everything.json()] == [project["id"]]
    assert still_readable.status_code == 200

    restored = await client.post(f"/api/v1/projects/{project['id']}/restore", headers=headers)
    assert restored.json()["archived_at"] is None
    assert len((await client.get(list_path, headers=headers)).json()) == 1


async def test_removing_workspace_member_removes_them_from_projects(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner, member, _ = await _setup(db_session)
    project = await _create(client, workspace, owner, member_ids=[str(member.id)])

    await client.delete(
        f"/api/v1/workspaces/{workspace.id}/members/{member.id}", headers=auth_headers(owner)
    )
    detail = await client.get(f"/api/v1/projects/{project['id']}", headers=auth_headers(owner))

    assert detail.json()["member_ids"] == [str(owner.id)]

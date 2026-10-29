from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, Project, User
from app.services.search import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace


async def _task(client: AsyncClient, project: Project, user: User, **fields: Any) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/projects/{project.id}/tasks", json=fields, headers=auth_headers(user)
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_search_matches_word_prefixes_in_title_and_description(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    project = await create_project(db_session, workspace, [owner])
    await _task(client, project, owner, title="Send the Acme invoice")
    await _task(client, project, owner, title="Call Mark", description="About the ACME renewal")
    await _task(client, project, owner, title="Unrelated")

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/search?q=acm", headers=auth_headers(owner)
    )

    assert response.status_code == 200
    assert {t["title"] for t in response.json()["tasks"]} == {
        "Send the Acme invoice",
        "Call Mark",
    }


async def test_search_includes_archived_projects_and_subtasks(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    project = await create_project(db_session, workspace, [owner], name="Acme Website")
    parent = await _task(client, project, owner, title="Launch")
    await _task(client, project, owner, title="Acme copy review", parent_id=parent["id"])
    project.archived_at = datetime.now(UTC)
    await db_session.flush()

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/search?q=acme", headers=auth_headers(owner)
    )

    body = response.json()
    assert [p["name"] for p in body["projects"]] == ["Acme Website"]
    assert body["projects"][0]["archived_at"] is not None
    assert [t["title"] for t in body["tasks"]] == ["Acme copy review"]


async def test_search_never_returns_other_workspaces(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    stranger = await create_user(db_session, email="stranger@example.com")
    other = await create_workspace(db_session, stranger, slug="other")
    secret = await create_project(db_session, other, [stranger], name="Acme Secret")
    await _task(client, secret, stranger, title="Acme secret task")

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/search?q=acme", headers=auth_headers(owner)
    )
    probe = await client.get(
        f"/api/v1/workspaces/{other.id}/search?q=acme", headers=auth_headers(owner)
    )

    assert response.json() == {"tasks": [], "projects": []}
    assert probe.status_code == 404


async def test_search_handles_symbols_and_wildcards_safely(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    await create_project(db_session, workspace, [owner], name="Q4_100% done")
    base = f"/api/v1/workspaces/{workspace.id}/search"
    headers = auth_headers(owner)

    symbols = await client.get(f"{base}?q=%26%20%7C%20!%20(", headers=headers)  # "& | ! ("
    percent = await client.get(f"{base}?q=%25", headers=headers)  # a literal "%"
    empty = await client.get(f"{base}?q=", headers=headers)

    assert symbols.status_code == 200
    assert [p["name"] for p in percent.json()["projects"]] == ["Q4_100% done"]
    assert empty.status_code == 400


async def test_task_list_search_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    project = await create_project(db_session, workspace, [owner])
    await _task(client, project, owner, title="Invoice Acme")
    await _task(client, project, owner, title="Design homepage")
    base = f"/api/v1/projects/{project.id}/tasks"

    found = await client.get(f"{base}?q=invo", headers=auth_headers(owner))
    nothing = await client.get(f"{base}?q=!!!", headers=auth_headers(owner))

    assert [t["title"] for t in found.json()["items"]] == ["Invoice Acme"]
    assert nothing.json()["total"] == 0


async def test_my_tasks_groups_open_tasks_by_due_date(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    mark = await add_member(db_session, workspace, "mark@example.com", MemberRole.member)
    project = await create_project(db_session, workspace, [owner, mark])
    archived = await create_project(db_session, workspace, [owner, mark], name="Old")
    today = user_today("Asia/Manila")
    mine = {"assignee_id": str(mark.id)}

    await _task(
        client, project, owner, title="Late", due_date=str(today - timedelta(days=2)), **mine
    )
    await _task(client, project, owner, title="Today", due_date=str(today), **mine)
    await _task(
        client, project, owner, title="Far", due_date=str(today + timedelta(days=30)), **mine
    )
    await _task(client, project, owner, title="Someday", **mine)
    await _task(client, project, owner, title="Finished", status="done", **mine)
    await _task(client, project, owner, title="Not mine", due_date=str(today))
    await _task(client, archived, owner, title="Archived", due_date=str(today), **mine)
    archived.archived_at = datetime.now(UTC)
    await db_session.flush()

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/my-tasks", headers=auth_headers(mark)
    )

    body = response.json()
    assert response.status_code == 200
    assert body["today"] == str(today)
    assert [t["title"] for t in body["overdue"]] == ["Late"]
    assert [t["title"] for t in body["due_today"]] == ["Today"]
    assert [t["title"] for t in body["later"]] == ["Far"]
    assert [t["title"] for t in body["no_date"]] == ["Someday"]
    assert body["this_week"] == []


async def test_viewers_have_no_my_tasks_page(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com")
    workspace = await create_workspace(db_session, owner)
    viewer = await add_member(db_session, workspace, "vic@example.com", MemberRole.viewer)

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/my-tasks", headers=auth_headers(viewer)
    )

    assert response.status_code == 403

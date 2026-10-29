from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, Project, User, Workspace
from app.services import notifications as notifications_service
from app.services.dates import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace


async def _setup(db: AsyncSession) -> tuple[Workspace, Project, User, User]:
    owner = await create_user(db, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    project = await create_project(db, workspace, [owner, mark])
    return workspace, project, owner, mark


async def _task(client: AsyncClient, project: Project, user: User, **fields: Any) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/projects/{project.id}/tasks",
        json={"title": "Send the Acme invoice", **fields},
        headers=auth_headers(user),
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _inbox(client: AsyncClient, user: User, query: str = "") -> dict[str, Any]:
    response = await client.get(f"/api/v1/notifications{query}", headers=auth_headers(user))
    body: dict[str, Any] = response.json()
    return body


async def test_assigning_someone_notifies_them_with_display_data(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, project, owner, mark = await _setup(db_session)

    task = await _task(client, project, owner, assignee_id=str(mark.id))

    inbox = await _inbox(client, mark)
    assert inbox["unread_count"] == 1
    [notification] = inbox["items"]
    assert notification["type"] == "assigned"
    assert notification["task_id"] == task["id"]
    assert notification["payload"] == {
        "task_title": "Send the Acme invoice",
        "project_id": str(project.id),
        "workspace_slug": "acme",
        "actor_name": "Olive",
    }


async def test_reassigning_notifies_only_the_new_assignee(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, project, owner, mark = await _setup(db_session)
    task = await _task(client, project, owner)

    await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"assignee_id": str(mark.id), "title": "Renamed"},
        headers=auth_headers(owner),
    )
    await client.patch(
        f"/api/v1/tasks/{task['id']}", json={"priority": "high"}, headers=auth_headers(owner)
    )
    await client.patch(
        f"/api/v1/tasks/{task['id']}", json={"assignee_id": None}, headers=auth_headers(owner)
    )

    items = (await _inbox(client, mark))["items"]
    assert [(n["type"], n["payload"]["task_title"]) for n in items] == [("assigned", "Renamed")]


async def test_assigning_yourself_sends_nothing(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, project, _, mark = await _setup(db_session)

    await _task(client, project, mark, assignee_id=str(mark.id))

    assert (await _inbox(client, mark))["unread_count"] == 0


async def test_mark_one_and_mark_all_read(client: AsyncClient, db_session: AsyncSession) -> None:
    _, project, owner, mark = await _setup(db_session)
    for title in ("A", "B", "C"):
        await _task(client, project, owner, title=title, assignee_id=str(mark.id))
    first = (await _inbox(client, mark))["items"][0]

    read = await client.post(
        f"/api/v1/notifications/{first['id']}/read", headers=auth_headers(mark)
    )
    after_one = await _inbox(client, mark)
    unread_only = await _inbox(client, mark, "?unread_only=true")
    all_read = await client.post("/api/v1/notifications/read-all", headers=auth_headers(mark))
    after_all = await _inbox(client, mark)

    assert read.json()["read_at"] is not None
    assert after_one["unread_count"] == 2
    assert len(unread_only["items"]) == 2
    assert all_read.status_code == 204
    assert after_all["unread_count"] == 0
    assert len(after_all["items"]) == 3


async def test_cannot_read_someone_elses_notification(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, project, owner, mark = await _setup(db_session)
    await _task(client, project, owner, assignee_id=str(mark.id))
    notification = (await _inbox(client, mark))["items"][0]

    response = await client.post(
        f"/api/v1/notifications/{notification['id']}/read", headers=auth_headers(owner)
    )

    assert response.status_code == 404
    assert (await _inbox(client, mark))["unread_count"] == 1


async def test_notifications_require_login(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/notifications")).status_code == 401


async def test_due_tomorrow_runs_once_per_task_and_skips_done_or_archived(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, project, owner, mark = await _setup(db_session)
    other = await create_project(db_session, workspace, [owner, mark], name="Old")
    tomorrow = str(user_today("Asia/Manila") + timedelta(days=1))
    mine = {"assignee_id": str(mark.id), "due_date": tomorrow}
    await _task(client, project, mark, title="Due tomorrow", **mine)
    await _task(client, project, mark, title="Already done", status="done", **mine)
    await _task(client, project, mark, title="Unassigned", due_date=tomorrow)
    await _task(client, other, mark, title="Archived project", **mine)
    other.archived_at = datetime.now(UTC)
    await db_session.flush()

    first_run = await notifications_service.create_due_tomorrow(db_session)
    second_run = await notifications_service.create_due_tomorrow(db_session)

    items = (await _inbox(client, mark))["items"]
    assert first_run == 1
    assert second_run == 0
    assert [(n["type"], n["payload"]["task_title"]) for n in items] == [
        ("due_tomorrow", "Due tomorrow")
    ]
    assert items[0]["payload"]["due_date"] == tomorrow
    assert items[0]["payload"]["actor_name"] is None

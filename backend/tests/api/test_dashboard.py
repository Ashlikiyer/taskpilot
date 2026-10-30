from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import MemberRole, Project, Task, TaskPriority, TaskStatus, User
from app.services.dates import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace

ZONE = get_settings().app_timezone


def _at(day: date, hour: int = 12) -> datetime:
    return datetime.combine(day, time(hour), tzinfo=ZoneInfo(ZONE)).astimezone(UTC)


def _task(project: Project, title: str, **fields: Any) -> Task:
    fields.setdefault("status", TaskStatus.todo)
    fields.setdefault("priority", TaskPriority.medium)
    return Task(project_id=project.id, title=title, position=1000, **fields)


async def _get(client: AsyncClient, user: User, ws_id: Any, **params: str) -> dict[str, Any]:
    response = await client.get(
        f"/api/v1/workspaces/{ws_id}/dashboard", params=params, headers=auth_headers(user)
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_dashboard_numbers(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive Owner")
    workspace = await create_workspace(db_session, owner)
    mark = await add_member(db_session, workspace, "mark@example.com", MemberRole.member)
    web = await create_project(db_session, workspace, [owner, mark], name="Website")
    ops = await create_project(db_session, workspace, [owner], name="Ops")
    old = await create_project(db_session, workspace, [owner], name="Old")
    old.archived_at = datetime.now(UTC)
    other_owner = await create_user(db_session, email="other@example.com", name="Other")
    other = await create_workspace(db_session, other_owner, name="Other", slug="other")
    elsewhere = await create_project(db_session, other, [other_owner], name="Elsewhere")

    today = user_today(ZONE)
    monday = today - timedelta(days=today.weekday())
    parent = _task(web, "Launch", status=TaskStatus.in_progress, assignee_id=mark.id)
    db_session.add(parent)
    await db_session.flush()
    db_session.add_all(
        [
            _task(web, "Late", due_date=today - timedelta(days=1), assignee_id=mark.id),
            _task(
                web,
                "Very late",
                due_date=today - timedelta(days=10),
                assignee_id=owner.id,
                created_at=_at(today - timedelta(days=20)),
            ),
            _task(ops, "Review", status=TaskStatus.in_review, source="ai_quick_add"),
            _task(
                web,
                "Done this week",
                status=TaskStatus.done,
                completed_at=_at(monday),
                source="import",
            ),
            _task(
                ops,
                "Done 2 weeks ago",
                status=TaskStatus.done,
                completed_at=_at(monday - timedelta(weeks=2)),
            ),
            # Not counted: a subtask, an archived project, another workspace.
            _task(web, "Subtask", parent_id=parent.id, assignee_id=mark.id),
            _task(old, "Archived", due_date=today - timedelta(days=3)),
            _task(elsewhere, "Not ours", due_date=today - timedelta(days=3)),
        ]
    )
    await db_session.flush()

    body = await _get(client, mark, workspace.id)

    assert body["open_total"] == 4
    assert body["open_projects"] == 2
    assert body["open_by_status"] == [
        {"status": "todo", "count": 2},
        {"status": "in_progress", "count": 1},
        {"status": "in_review", "count": 1},
    ]
    assert body["overdue"] == 2
    assert body["overdue_week_ago"] == 1  # only "Very late" was due before then
    assert len(body["completed_per_week"]) == 8
    assert body["completed_per_week"][-1] == {"week_start": monday.isoformat(), "count": 1}
    assert body["completed_per_week"][-3]["count"] == 1
    assert body["completed_this_week"] == 1
    assert [(m["name"], m["open"]) for m in body["workload"]] == [
        ("Mark", 2),
        ("Olive Owner", 1),
    ]
    assert body["created_recently"] == 6
    assert body["created_by_ai"] == 2


async def test_dashboard_for_one_project(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner)
    web = await create_project(db_session, workspace, [owner], name="Website")
    ops = await create_project(db_session, workspace, [owner], name="Ops")
    db_session.add_all([_task(web, "A"), _task(web, "B"), _task(ops, "C")])
    await db_session.flush()

    body = await _get(client, owner, workspace.id, project_id=str(web.id))

    assert body["project_id"] == str(web.id)
    assert body["open_total"] == 2


async def test_viewers_see_it_and_outsiders_get_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session)
    workspace = await create_workspace(db_session, owner)
    viewer = await add_member(db_session, workspace, "vic@example.com", MemberRole.viewer)
    outsider = await create_user(db_session, email="out@example.com", name="Out")
    other = await create_workspace(db_session, outsider, name="Other", slug="other")
    theirs = await create_project(db_session, other, [outsider], name="Theirs")

    assert (await _get(client, viewer, workspace.id))["open_total"] == 0
    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard", headers=auth_headers(outsider)
    )
    assert response.status_code == 404
    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/dashboard",
        params={"project_id": str(theirs.id)},
        headers=auth_headers(owner),
    )
    assert response.status_code == 404

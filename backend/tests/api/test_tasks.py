from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityLog, MemberRole, Project, Task, User, Workspace
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace


@dataclass
class World:
    workspace: Workspace
    project: Project
    owner: User
    member: User  # on the project
    outsider_member: User  # workspace member, not on the project
    viewer: User


async def _world(db: AsyncSession) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db, owner)
    member = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    outsider = await add_member(db, workspace, "nina@example.com", MemberRole.member)
    viewer = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    project = await create_project(db, workspace, [owner, member])
    return World(workspace, project, owner, member, outsider, viewer)


async def _create(
    client: AsyncClient, w: World, user: User | None = None, **fields: Any
) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Send the Acme invoice", **fields},
        headers=auth_headers(user or w.member),
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _column(client: AsyncClient, w: World, status: str = "todo") -> list[str]:
    response = await client.get(
        f"/api/v1/projects/{w.project.id}/tasks?status={status}", headers=auth_headers(w.owner)
    )
    return [task["title"] for task in response.json()["items"]]


# --- create -------------------------------------------------------------------


async def test_member_creates_task_with_defaults(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)

    task = await _create(client, w, title="  Draft homepage copy ")

    assert task["title"] == "Draft homepage copy"
    assert task["status"] == "todo"
    assert task["priority"] == "medium"
    assert task["source"] == "manual"
    assert task["created_by"] == str(w.member.id)
    assert task["subtask_count"] == 0


async def test_title_is_required_and_limited_to_200_chars(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    path = f"/api/v1/projects/{w.project.id}/tasks"
    headers = auth_headers(w.member)

    blank = await client.post(path, json={"title": "   "}, headers=headers)
    too_long = await client.post(path, json={"title": "x" * 201}, headers=headers)

    assert blank.status_code == 400
    assert too_long.status_code == 400


async def test_viewer_cannot_create_tasks(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)

    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Nope"},
        headers=auth_headers(w.viewer),
    )

    assert response.status_code == 403


async def test_member_outside_project_cannot_create_but_admin_can(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    admin = await add_member(db_session, w.workspace, "ada@example.com", MemberRole.admin)
    path = f"/api/v1/projects/{w.project.id}/tasks"

    outsider = await client.post(path, json={"title": "x"}, headers=auth_headers(w.outsider_member))
    by_admin = await client.post(path, json={"title": "x"}, headers=auth_headers(admin))

    assert outsider.status_code == 403
    assert by_admin.status_code == 201


async def test_archived_project_is_read_only(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)
    task = await _create(client, w)
    w.project.archived_at = datetime.now(UTC)
    await db_session.flush()
    headers = auth_headers(w.member)

    create = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks", json={"title": "x"}, headers=headers
    )
    patch = await client.patch(f"/api/v1/tasks/{task['id']}", json={"title": "y"}, headers=headers)
    read = await client.get(f"/api/v1/tasks/{task['id']}", headers=headers)

    assert create.status_code == 409
    assert patch.status_code == 409
    assert read.status_code == 200


async def test_assignee_must_be_able_to_work_on_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    path = f"/api/v1/projects/{w.project.id}/tasks"
    headers = auth_headers(w.owner)

    to_viewer = await client.post(
        path, json={"title": "x", "assignee_id": str(w.viewer.id)}, headers=headers
    )
    to_non_project_member = await client.post(
        path, json={"title": "x", "assignee_id": str(w.outsider_member.id)}, headers=headers
    )
    to_project_member = await client.post(
        path, json={"title": "x", "assignee_id": str(w.member.id)}, headers=headers
    )

    assert to_viewer.status_code == 400
    assert to_non_project_member.status_code == 400
    assert to_project_member.status_code == 201


# --- isolation ------------------------------------------------------------------


async def test_other_workspace_task_returns_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _create(client, w)
    stranger = await create_user(db_session, email="stranger@example.com")
    await create_workspace(db_session, stranger, slug="other")
    headers = auth_headers(stranger)

    for method, path in [
        ("GET", f"/api/v1/tasks/{task['id']}"),
        ("PATCH", f"/api/v1/tasks/{task['id']}"),
        ("DELETE", f"/api/v1/tasks/{task['id']}"),
        ("GET", f"/api/v1/tasks/{task['id']}/activity"),
    ]:
        response = await client.request(method, path, json={"title": "x"}, headers=headers)
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "TASK_NOT_FOUND"


# --- subtasks -------------------------------------------------------------------


async def test_subtasks_show_progress_without_completing_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    parent = await _create(client, w, title="Launch site")
    for title, status in [("Write copy", "done"), ("Pick photos", "done"), ("Test forms", "todo")]:
        await _create(client, w, title=title, parent_id=parent["id"], status=status)

    detail = await client.get(f"/api/v1/tasks/{parent['id']}", headers=auth_headers(w.member))
    subtasks = await client.get(
        f"/api/v1/projects/{w.project.id}/tasks?parent_id={parent['id']}",
        headers=auth_headers(w.member),
    )

    assert detail.json()["subtask_count"] == 3
    assert detail.json()["subtasks_done"] == 2
    assert detail.json()["status"] == "todo"
    assert [t["title"] for t in subtasks.json()["items"]] == [
        "Write copy",
        "Pick photos",
        "Test forms",
    ]
    assert await _column(client, w) == ["Launch site"]  # subtasks stay off the board


async def test_subtask_of_a_subtask_is_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    parent = await _create(client, w, title="Parent")
    child = await _create(client, w, title="Child", parent_id=parent["id"])

    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Grandchild", "parent_id": child["id"]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_parent_must_be_in_same_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    other = await create_project(db_session, w.workspace, [w.owner, w.member], name="Other")
    parent = await _create(client, w)

    response = await client.post(
        f"/api/v1/projects/{other.id}/tasks",
        json={"title": "x", "parent_id": parent["id"]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 400


# --- updates and activity ------------------------------------------------------------


async def test_update_writes_activity_entries(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _create(client, w, title="Old title")

    response = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"title": "New title", "priority": "high", "assignee_id": str(w.member.id)},
        headers=auth_headers(w.owner),
    )
    activity = await client.get(
        f"/api/v1/tasks/{task['id']}/activity", headers=auth_headers(w.viewer)
    )

    assert response.status_code == 200
    entries = {(a["action"], a["field"], a["old_value"], a["new_value"]) for a in activity.json()}
    assert entries == {
        ("created", None, None, "Old title"),
        ("updated", "title", "Old title", "New title"),
        ("updated", "priority", "medium", "high"),
        ("updated", "assignee_id", None, str(w.member.id)),
    }
    assert all(a["actor_name"] for a in activity.json())


async def test_unchanged_fields_write_no_activity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _create(client, w, title="Same")

    await client.patch(
        f"/api/v1/tasks/{task['id']}", json={"title": "Same"}, headers=auth_headers(w.member)
    )
    activity = await client.get(
        f"/api/v1/tasks/{task['id']}/activity", headers=auth_headers(w.member)
    )

    assert [a["action"] for a in activity.json()] == ["created"]


async def test_done_sets_completed_at_and_reopening_clears_it(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _create(client, w)
    path = f"/api/v1/tasks/{task['id']}"
    headers = auth_headers(w.member)

    done = await client.patch(path, json={"status": "done"}, headers=headers)
    reopened = await client.patch(path, json={"status": "in_progress"}, headers=headers)

    assert done.json()["completed_at"] is not None
    assert reopened.json()["completed_at"] is None


async def test_status_cannot_be_set_to_null(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)
    task = await _create(client, w)

    response = await client.patch(
        f"/api/v1/tasks/{task['id']}", json={"status": None}, headers=auth_headers(w.member)
    )

    assert response.status_code == 400


async def test_labels_are_set_and_logged(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)
    headers = auth_headers(w.member)
    labels_path = f"/api/v1/workspaces/{w.workspace.id}/labels"
    billing = (await client.post(labels_path, json={"name": "Billing"}, headers=headers)).json()
    client_label = (
        await client.post(labels_path, json={"name": "Client", "color": "#EF4444"}, headers=headers)
    ).json()
    task = await _create(client, w, label_ids=[billing["id"]])

    updated = await client.patch(
        f"/api/v1/tasks/{task['id']}",
        json={"label_ids": [billing["id"], client_label["id"]]},
        headers=headers,
    )
    activity = await client.get(f"/api/v1/tasks/{task['id']}/activity", headers=headers)

    assert [lb["name"] for lb in updated.json()["labels"]] == ["Billing", "Client"]
    assert client_label["color"] == "#ef4444"
    assert ("labels", "Billing", "Billing, Client") in {
        (a["field"], a["old_value"], a["new_value"]) for a in activity.json()
    }


async def test_labels_from_another_workspace_are_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    stranger = await create_user(db_session, email="stranger@example.com")
    other = await create_workspace(db_session, stranger, slug="other")
    foreign = (
        await client.post(
            f"/api/v1/workspaces/{other.id}/labels",
            json={"name": "Secret"},
            headers=auth_headers(stranger),
        )
    ).json()

    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "x", "label_ids": [foreign["id"]]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 400


async def test_duplicate_label_name_conflicts_and_viewer_cannot_create(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    path = f"/api/v1/workspaces/{w.workspace.id}/labels"

    await client.post(path, json={"name": "Urgent"}, headers=auth_headers(w.member))
    duplicate = await client.post(path, json={"name": "urgent"}, headers=auth_headers(w.member))
    by_viewer = await client.post(path, json={"name": "New"}, headers=auth_headers(w.viewer))
    listed = await client.get(path, headers=auth_headers(w.viewer))

    assert duplicate.status_code == 409
    assert by_viewer.status_code == 403
    assert [lb["name"] for lb in listed.json()] == ["Urgent"]


# --- ordering ---------------------------------------------------------------------


async def test_new_tasks_go_to_the_bottom_of_their_column(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    for title in ("A", "B", "C"):
        await _create(client, w, title=title)

    assert await _column(client, w) == ["A", "B", "C"]


async def test_moving_a_card_between_two_cards(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    a = await _create(client, w, title="A")
    b = await _create(client, w, title="B")
    c = await _create(client, w, title="C")

    response = await client.post(
        f"/api/v1/tasks/{c['id']}/move",
        json={"status": "todo", "before_id": a["id"], "after_id": b["id"]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 200
    assert a["position"] < response.json()["position"] < b["position"]
    assert await _column(client, w) == ["A", "C", "B"]


async def test_moving_to_another_column_changes_status(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    doing = await _create(client, w, title="Doing", status="in_progress")
    task = await _create(client, w, title="Card")

    moved = await client.post(
        f"/api/v1/tasks/{task['id']}/move",
        json={"status": "in_progress", "after_id": doing["id"]},
        headers=auth_headers(w.member),
    )
    activity = await client.get(
        f"/api/v1/tasks/{task['id']}/activity", headers=auth_headers(w.member)
    )

    assert moved.json()["status"] == "in_progress"
    assert await _column(client, w, "in_progress") == ["Card", "Doing"]
    assert ("status", "todo", "in_progress") in {
        (a["field"], a["old_value"], a["new_value"]) for a in activity.json()
    }


async def test_move_rebalances_when_the_gap_is_too_small(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    a = await _create(client, w, title="A")
    b = await _create(client, w, title="B")
    c = await _create(client, w, title="C")
    # Squeeze A and B together so their gap can't be split any more.
    rows = (await db_session.execute(select(Task).where(Task.title.in_(["A", "B"])))).scalars()
    for row in rows:
        row.position = 1.0 if row.title == "A" else 1.0 + 1e-9
    await db_session.flush()

    response = await client.post(
        f"/api/v1/tasks/{c['id']}/move",
        json={"status": "todo", "before_id": a["id"], "after_id": b["id"]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 200
    assert await _column(client, w) == ["A", "C", "B"]


async def test_move_rejects_neighbours_from_another_column(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    a = await _create(client, w, title="A", status="done")
    b = await _create(client, w, title="B")

    response = await client.post(
        f"/api/v1/tasks/{b['id']}/move",
        json={"status": "todo", "before_id": a["id"]},
        headers=auth_headers(w.member),
    )

    assert response.status_code == 400


# --- listing ----------------------------------------------------------------------


async def test_list_filters_sorts_and_paginates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    await _create(client, w, title="Low", priority="low", due_date="2026-11-03")
    await _create(client, w, title="Urgent", priority="urgent", assignee_id=str(w.member.id))
    await _create(client, w, title="High", priority="high", due_date="2026-11-01")
    base = f"/api/v1/projects/{w.project.id}/tasks"
    headers = auth_headers(w.viewer)

    by_priority = await client.get(f"{base}?sort=-priority", headers=headers)
    mine = await client.get(f"{base}?assignee_id={w.member.id}", headers=headers)
    due = await client.get(f"{base}?due_from=2026-11-02&due_to=2026-11-30", headers=headers)
    paged = await client.get(f"{base}?page=2&page_size=2", headers=headers)
    bad_sort = await client.get(f"{base}?sort=password", headers=headers)
    too_big = await client.get(f"{base}?page_size=101", headers=headers)

    assert [t["title"] for t in by_priority.json()["items"]] == ["Urgent", "High", "Low"]
    assert [t["title"] for t in mine.json()["items"]] == ["Urgent"]
    assert [t["title"] for t in due.json()["items"]] == ["Low"]
    assert paged.json()["total"] == 3
    assert [t["title"] for t in paged.json()["items"]] == ["High"]
    assert bad_sort.status_code == 400
    assert too_big.status_code == 400


# --- delete ---------------------------------------------------------------------


async def test_member_cannot_delete_others_tasks(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    owners_task = await _create(client, w, user=w.owner)
    own_task = await _create(client, w, user=w.member)

    others = await client.delete(
        f"/api/v1/tasks/{owners_task['id']}", headers=auth_headers(w.member)
    )
    own = await client.delete(f"/api/v1/tasks/{own_task['id']}", headers=auth_headers(w.member))
    by_admin = await client.delete(
        f"/api/v1/tasks/{owners_task['id']}", headers=auth_headers(w.owner)
    )

    assert others.status_code == 403
    assert own.status_code == 204
    assert by_admin.status_code == 204


async def test_delete_removes_subtasks_but_keeps_activity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    parent = await _create(client, w, title="Parent")
    await _create(client, w, title="Child", parent_id=parent["id"])

    response = await client.delete(f"/api/v1/tasks/{parent['id']}", headers=auth_headers(w.member))
    remaining = (await db_session.execute(select(Task))).scalars().all()
    history = (
        (
            await db_session.execute(
                select(ActivityLog.action).where(ActivityLog.task_id == parent["id"])
            )
        )
        .scalars()
        .all()
    )

    assert response.status_code == 204
    assert remaining == []
    assert sorted(history) == ["created", "deleted"]

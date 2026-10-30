from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, Notification, Project, User, Workspace
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace


@dataclass
class World:
    workspace: Workspace
    project: Project
    owner: User
    mark: User  # project member, the task's assignee
    nina: User  # project member
    vic: User  # viewer


async def _world(db: AsyncSession) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    nina = await add_member(db, workspace, "nina@example.com", MemberRole.member)
    vic = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    project = await create_project(db, workspace, [owner, mark, nina])
    return World(workspace, project, owner, mark, nina, vic)


async def _task(client: AsyncClient, w: World, **fields: Any) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Send the Acme invoice", **fields},
        headers=auth_headers(w.owner),
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def _comment(
    client: AsyncClient, task: dict[str, Any], user: User, body: str
) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": body}, headers=auth_headers(user)
    )
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def _inbox(client: AsyncClient, user: User) -> list[tuple[str, str | None]]:
    response = await client.get("/api/v1/notifications", headers=auth_headers(user))
    return [(n["type"], n["payload"].get("excerpt")) for n in response.json()["items"]]


def _mention(user: User) -> str:
    return f"@[{user.name}]({user.id})"


# --- comments -----------------------------------------------------------------


async def test_viewer_can_comment_and_everyone_sees_the_thread(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)

    first = await _comment(client, task, w.vic, "  Looks good to me  ")
    await _comment(client, task, w.mark, "Thanks!")
    thread = await client.get(f"/api/v1/tasks/{task['id']}/comments", headers=auth_headers(w.nina))

    assert first["body"] == "Looks good to me"
    assert first["author_name"] == "Vic"
    assert [(c["author_name"], c["body"]) for c in thread.json()] == [
        ("Vic", "Looks good to me"),
        ("Mark", "Thanks!"),
    ]


async def test_comment_body_is_required(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)
    task = await _task(client, w)

    response = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "   "}, headers=auth_headers(w.mark)
    )

    assert response.status_code == 400


async def test_outsiders_get_404_for_comments(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    comment = await _comment(client, task, w.mark, "hi")
    stranger = await create_user(db_session, email="stranger@example.com")
    headers = auth_headers(stranger)

    listing = await client.get(f"/api/v1/tasks/{task['id']}/comments", headers=headers)
    edit = await client.patch(
        f"/api/v1/comments/{comment['id']}", json={"body": "x"}, headers=headers
    )

    assert listing.status_code == 404
    assert edit.status_code == 404
    assert edit.json()["error"]["code"] == "COMMENT_NOT_FOUND"


async def test_only_the_author_can_edit_or_delete(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    comment = await _comment(client, task, w.mark, "Original")
    path = f"/api/v1/comments/{comment['id']}"

    by_owner = await client.patch(path, json={"body": "Hijacked"}, headers=auth_headers(w.owner))
    edited = await client.patch(path, json={"body": "Fixed typo"}, headers=auth_headers(w.mark))
    delete_by_owner = await client.delete(path, headers=auth_headers(w.owner))
    deleted = await client.delete(path, headers=auth_headers(w.mark))

    assert by_owner.status_code == 403
    assert edited.json()["body"] == "Fixed typo"
    assert edited.json()["edited_at"] is not None
    assert delete_by_owner.status_code == 403
    assert deleted.status_code == 204


async def test_archived_project_comments_are_read_only(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    await _comment(client, task, w.mark, "Before archiving")
    w.project.archived_at = datetime.now(UTC)
    await db_session.flush()

    create = await client.post(
        f"/api/v1/tasks/{task['id']}/comments", json={"body": "x"}, headers=auth_headers(w.mark)
    )
    read = await client.get(f"/api/v1/tasks/{task['id']}/comments", headers=auth_headers(w.mark))

    assert create.status_code == 409
    assert len(read.json()) == 1


# --- notifications from comments ------------------------------------------------------


async def test_mention_notifies_the_mentioned_member(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)

    await _comment(client, task, w.mark, f"{_mention(w.nina)} can you check the totals?")

    assert await _inbox(client, w.nina) == [("mentioned", "@Nina can you check the totals?")]


async def test_comment_notifies_assignee_and_creator_but_never_the_author(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w, assignee_id=str(w.mark.id))  # created by owner
    await client.post("/api/v1/notifications/read-all", headers=auth_headers(w.mark))

    await _comment(client, task, w.nina, "Done on my side")

    assert await _inbox(client, w.owner) == [("comment", "Done on my side")]
    assert [kind for kind, _ in await _inbox(client, w.mark)] == ["comment", "assigned"]
    assert await _inbox(client, w.nina) == []


async def test_mentioned_watcher_gets_one_notification_not_two(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)  # owner is the creator

    await _comment(client, task, w.mark, f"{_mention(w.owner)} please review")

    assert [kind for kind, _ in await _inbox(client, w.owner)] == ["mentioned"]


async def test_mentions_of_outsiders_and_self_are_ignored(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    stranger = await create_user(db_session, email="stranger@example.com", name="Stranger")

    await _comment(client, task, w.mark, f"{_mention(stranger)} {_mention(w.mark)} hello")

    count = await db_session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id.in_([stranger.id, w.mark.id]))
    )
    assert count == 0


async def test_editing_a_comment_only_notifies_new_mentions(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    comment = await _comment(client, task, w.mark, f"{_mention(w.nina)} hi")

    await client.patch(
        f"/api/v1/comments/{comment['id']}",
        json={"body": f"{_mention(w.nina)} {_mention(w.vic)} hi"},
        headers=auth_headers(w.mark),
    )

    assert [kind for kind, _ in await _inbox(client, w.nina)] == ["mentioned"]
    assert [kind for kind, _ in await _inbox(client, w.vic)] == ["mentioned"]


async def test_deleting_a_task_deletes_its_notifications(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    await _comment(client, task, w.mark, f"{_mention(w.nina)} hi")

    await client.delete(f"/api/v1/tasks/{task['id']}", headers=auth_headers(w.owner))

    assert await _inbox(client, w.nina) == []


async def test_tasks_show_their_comment_count(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    task = await _task(client, w)
    await _comment(client, task, w.mark, "First")
    await _comment(client, task, w.nina, "Second")

    listing = await client.get(
        f"/api/v1/projects/{w.project.id}/tasks", headers=auth_headers(w.owner)
    )

    assert [t["comment_count"] for t in listing.json()["items"]] == [2]

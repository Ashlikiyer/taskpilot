import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, Project, User
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace
from tests.fakes import FakeProvider

STEPS = ["Draft the invoice", "Check totals with finance", "Email it to Acme"]


@dataclass
class World:
    project: Project
    owner: User
    mark: User  # on the project
    nina: User  # workspace member, not on the project
    vic: User  # viewer
    task: dict[str, Any]


async def _world(db: AsyncSession, client: AsyncClient) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    nina = await add_member(db, workspace, "nina@example.com", MemberRole.member)
    vic = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    project = await create_project(db, workspace, [owner, mark], name="Acme Website")
    task = (
        await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            json={"title": "Send the Acme invoice", "description": "Due before month end"},
            headers=auth_headers(owner),
        )
    ).json()
    return World(project, owner, mark, nina, vic, task)


async def _suggest(client: AsyncClient, task_id: str, user: User) -> Any:
    return await client.post(f"/api/v1/tasks/{task_id}/ai/subtasks", headers=auth_headers(user))


async def test_suggests_subtasks_from_task_context(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Get the PO number", "parent_id": w.task["id"]},
        headers=auth_headers(w.owner),
    )
    fake_ai.reply({"subtasks": STEPS})

    response = await _suggest(client, w.task["id"], w.mark)

    assert response.status_code == 200
    assert response.json() == {"subtasks": STEPS}
    context = json.loads(fake_ai.calls[0].messages[0].content)
    assert context == {
        "TASK": "Send the Acme invoice",
        "DESCRIPTION": "Due before month end",
        "PROJECT": "Acme Website",
        "EXISTING_SUBTASKS": ["Get the PO number"],
    }


async def test_nothing_is_saved_until_the_user_picks(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply({"subtasks": STEPS})

    await _suggest(client, w.task["id"], w.mark)
    task = await client.get(f"/api/v1/tasks/{w.task['id']}", headers=auth_headers(w.mark))

    assert task.json()["subtask_count"] == 0


async def test_existing_subtasks_are_never_suggested_again(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "Draft the invoice", "parent_id": w.task["id"]},
        headers=auth_headers(w.owner),
    )
    fake_ai.reply({"subtasks": [*STEPS, "email IT to acme"]})

    response = await _suggest(client, w.task["id"], w.mark)

    assert response.json()["subtasks"] == ["Check totals with finance", "Email it to Acme"]


async def test_too_few_or_too_long_suggestions_are_retried(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply({"subtasks": ["Do it", "x" * 121]}, {"subtasks": STEPS})

    response = await _suggest(client, w.task["id"], w.mark)

    assert response.json()["subtasks"] == STEPS
    assert len(fake_ai.calls) == 2


async def test_only_people_who_can_edit_the_task_get_suggestions(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)

    by_viewer = await _suggest(client, w.task["id"], w.vic)
    off_project = await _suggest(client, w.task["id"], w.nina)

    assert by_viewer.status_code == 403
    assert off_project.status_code == 403
    assert fake_ai.calls == []


async def test_subtasks_and_archived_projects_are_rejected(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    child = (
        await client.post(
            f"/api/v1/projects/{w.project.id}/tasks",
            json={"title": "Child", "parent_id": w.task["id"]},
            headers=auth_headers(w.owner),
        )
    ).json()

    on_subtask = await _suggest(client, child["id"], w.mark)
    w.project.archived_at = datetime.now(UTC)
    await db_session.flush()
    on_archived = await _suggest(client, w.task["id"], w.mark)

    assert on_subtask.status_code == 400
    assert on_archived.status_code == 409
    assert fake_ai.calls == []


async def test_other_workspaces_get_404(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    stranger = await create_user(db_session, email="stranger@example.com")

    response = await _suggest(client, w.task["id"], stranger)

    assert response.status_code == 404
    assert fake_ai.calls == []

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityLog, AIUsage, Digest, MemberRole, Project, User, Workspace
from app.services.ai.provider import ProviderError
from app.services.dates import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace
from tests.fakes import FakeProvider

CRON = {"X-Cron-Secret": "test-cron-secret"}
SUMMARY = {"summary": "Morning Mark! One invoice is overdue; start there."}


@dataclass
class World:
    workspace: Workspace
    project: Project
    owner: User
    mark: User
    vic: User


async def _world(db: AsyncSession) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    vic = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    project = await create_project(db, workspace, [owner, mark], name="Acme Website")
    return World(workspace, project, owner, mark, vic)


async def _task(client: AsyncClient, w: World, **fields: Any) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"assignee_id": str(w.mark.id), **fields},
        headers=auth_headers(w.owner),
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _day(offset: int) -> str:
    return str(user_today("Asia/Manila") + timedelta(days=offset))


async def _run(client: AsyncClient, headers: dict[str, str] = CRON) -> Any:
    return await client.post("/api/v1/internal/digest/run", headers=headers)


async def test_run_requires_the_cron_secret(client: AsyncClient, fake_ai: FakeProvider) -> None:
    missing = await _run(client, headers={})
    wrong = await _run(client, headers={"X-Cron-Secret": "guess"})

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert fake_ai.calls == []


async def test_run_builds_lists_summary_and_notification(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    await _task(client, w, title="Send invoice", due_date=_day(-2))
    await _task(client, w, title="Call Acme", due_date=_day(0))
    await _task(client, w, title="Draft copy", due_date=_day(1))
    await _task(client, w, title="Finished", due_date=_day(-1), status="done")
    fake_ai.reply(SUMMARY)

    response = await _run(client)

    assert response.status_code == 200
    assert response.json()["digests_created"] == 2  # Mark and Olive (viewers get none)
    assert response.json()["notifications_sent"] == 1  # only Mark has tasks
    digest = (
        await client.get(
            f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.mark)
        )
    ).json()
    content = digest["content"]
    assert [t["title"] for t in content["overdue"]] == ["Send invoice"]
    assert [t["title"] for t in content["due_today"]] == ["Call Acme"]
    assert [(t["title"], t["reason"]) for t in content["at_risk"]] == [("Draft copy", "due_soon")]
    assert digest["summary"] == SUMMARY["summary"]

    context = json.loads(fake_ai.calls[0].messages[0].content)
    assert context["NAME"] == "Mark"
    assert [t["title"] for t in context["OVERDUE"]] == ["Send invoice"]
    assert "@example.com" not in fake_ai.calls[0].messages[0].content

    bell = (await client.get("/api/v1/notifications", headers=auth_headers(w.mark))).json()
    digest_note = next(n for n in bell["items"] if n["type"] == "digest")
    assert digest_note["payload"]["overdue"] == 1
    assert digest_note["payload"]["workspace_slug"] == "acme"


async def test_running_twice_the_same_day_creates_one_digest(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    await _task(client, w, title="Send invoice", due_date=_day(-1))
    fake_ai.reply(SUMMARY)

    first = await _run(client)
    second = await _run(client)

    count = await db_session.scalar(select(func.count()).select_from(Digest))
    assert first.json()["digests_created"] == 2
    assert second.json()["digests_created"] == 0
    assert count == 2
    assert len(fake_ai.calls) == 1


async def test_empty_digest_skips_ai_and_notification(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)

    await _run(client)
    digest = (
        await client.get(
            f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.mark)
        )
    ).json()

    assert digest["content"] == {"overdue": [], "due_today": [], "at_risk": []}
    assert digest["summary"] is None
    assert fake_ai.calls == []
    bell = (await client.get("/api/v1/notifications", headers=auth_headers(w.mark))).json()
    assert bell["items"] == []


async def test_ai_failure_still_sends_the_digest_without_summary(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    await _task(client, w, title="Send invoice", due_date=_day(0))
    fake_ai.reply(ProviderError("down"))

    response = await _run(client)
    digest = (
        await client.get(
            f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.mark)
        )
    ).json()

    assert response.json()["notifications_sent"] == 1
    assert digest["summary"] is None
    assert [t["title"] for t in digest["content"]["due_today"]] == ["Send invoice"]


async def test_digest_calls_dont_use_up_the_personal_limit(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    db_session.add_all(
        AIUsage(user_id=w.mark.id, feature="quick_add", model="m", success=True) for _ in range(50)
    )
    await db_session.flush()
    await _task(client, w, title="Send invoice", due_date=_day(0))
    fake_ai.reply(SUMMARY, {"title": "never sent"})

    await _run(client)
    quick_add = await client.post(
        f"/api/v1/workspaces/{w.workspace.id}/ai/quick-add",
        json={"text": "x"},
        headers=auth_headers(w.mark),
    )

    digest = (
        await client.get(
            f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.mark)
        )
    ).json()
    assert digest["summary"] == SUMMARY["summary"]  # digest still summarized
    assert quick_add.status_code == 429  # and digest calls didn't free or use quota


async def test_digest_page_builds_on_first_view_and_stays_in_its_workspace(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    other_ws = await create_workspace(db_session, w.owner, name="Other", slug="other")
    other_project = await create_project(db_session, other_ws, [w.owner], name="Other work")
    await _task(client, w, title="Acme task", due_date=_day(0), assignee_id=str(w.owner.id))
    await client.post(
        f"/api/v1/projects/{other_project.id}/tasks",
        json={"title": "Other task", "due_date": _day(0), "assignee_id": str(w.owner.id)},
        headers=auth_headers(w.owner),
    )
    fake_ai.reply(SUMMARY)

    response = await client.get(
        f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.owner)
    )

    assert response.status_code == 200
    assert [t["title"] for t in response.json()["content"]["due_today"]] == ["Acme task"]
    digest = await db_session.scalar(select(Digest).where(Digest.user_id == w.owner.id))
    assert digest is not None and digest.read_at is not None


async def test_viewers_and_outsiders_have_no_digest(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    stranger = await create_user(db_session, email="stranger@example.com")
    path = f"/api/v1/workspaces/{w.workspace.id}/digest/today"

    by_viewer = await client.get(path, headers=auth_headers(w.vic))
    by_stranger = await client.get(path, headers=auth_headers(stranger))

    assert by_viewer.status_code == 403
    assert by_stranger.status_code == 404


async def test_in_progress_task_with_old_activity_is_stalled(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    task = await _task(client, w, title="Migrate DNS", status="in_progress")
    six_days_ago = datetime.now(UTC) - timedelta(days=6)
    await db_session.execute(
        update(ActivityLog).where(ActivityLog.task_id == task["id"]).values(created_at=six_days_ago)
    )
    await db_session.flush()
    fake_ai.reply(SUMMARY)

    digest = (
        await client.get(
            f"/api/v1/workspaces/{w.workspace.id}/digest/today", headers=auth_headers(w.mark)
        )
    ).json()

    assert [(t["title"], t["reason"]) for t in digest["content"]["at_risk"]] == [
        ("Migrate DNS", "stalled")
    ]


async def test_run_also_sends_due_tomorrow_notifications(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session)
    await _task(client, w, title="Pay hosting", due_date=_day(1))
    fake_ai.reply(SUMMARY)

    response = await _run(client)

    assert response.json()["due_tomorrow_notifications"] == 1

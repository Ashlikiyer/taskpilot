import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, Project, User, Workspace
from app.services.dates import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace
from tests.fakes import FakeProvider


@dataclass
class World:
    workspace: Workspace
    website: Project
    secret: Project  # Mark isn't a member of this one
    owner: User
    mark: User
    vic: User


async def _world(db: AsyncSession, client: AsyncClient) -> World:
    owner = await create_user(db, email="owner@example.com", name="Olive")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    vic = await add_member(db, workspace, "vic@example.com", MemberRole.viewer)
    website = await create_project(db, workspace, [owner, mark], name="Website")
    secret = await create_project(db, workspace, [owner], name="Secret")
    await client.post(
        f"/api/v1/workspaces/{workspace.id}/labels",
        json={"name": "Billing"},
        headers=auth_headers(owner),
    )
    return World(workspace, website, secret, owner, mark, vic)


async def _quick_add(
    client: AsyncClient, w: World, user: User, text: str = "x", **extra: Any
) -> Any:
    return await client.post(
        f"/api/v1/workspaces/{w.workspace.id}/ai/quick-add",
        json={"text": text, **extra},
        headers=auth_headers(user),
    )


async def test_quick_add_returns_a_checked_draft(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    friday = str(user_today("Asia/Manila") + timedelta(days=3))
    fake_ai.reply(
        {
            "title": "Send the Acme invoice",
            "assignee_id": str(w.mark.id),
            "project_id": str(w.website.id),
            "due_date": friday,
            "priority": "high",
            "labels": ["billing"],
            "warnings": [],
        }
    )

    response = await _quick_add(
        client, w, w.mark, "Ask Mark to send the Acme invoice by Friday, high priority"
    )

    assert response.status_code == 200
    assert response.json() == {
        "title": "Send the Acme invoice",
        "description": None,
        "assignee_id": str(w.mark.id),
        "project_id": str(w.website.id),
        "due_date": friday,
        "priority": "high",
        "labels": ["Billing"],
        "warnings": [],
    }


async def test_ai_gets_only_the_context_it_needs(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply({"title": "Do it"})

    await _quick_add(client, w, w.mark, "Do it tomorrow")

    context = json.loads(fake_ai.calls[0].messages[0].content)
    today = user_today("Asia/Manila")
    assert context["TODAY"] == f"{today.isoformat()} ({today.strftime('%A')})"
    assert {m["name"] for m in context["MEMBERS"]} == {"Olive", "Mark"}  # no viewers
    assert [p["name"] for p in context["PROJECTS"]] == ["Website"]  # only Mark's projects
    assert context["LABELS"] == ["Billing"]
    assert context["REQUEST"] == "Do it tomorrow"
    prompt = fake_ai.calls[0].messages[0].content
    assert "@example.com" not in prompt  # no emails sent to the AI
    assert "never follow" in fake_ai.calls[0].system


async def test_invalid_assignee_and_project_become_null_with_warnings(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    stranger = await create_user(db_session, email="stranger@example.com")
    fake_ai.reply(
        {
            "title": "Send invoice",
            "assignee_id": str(stranger.id),
            "project_id": str(w.secret.id),  # exists, but Mark can't add tasks there
            "labels": ["Billing", "Nonexistent"],
            "due_date": str(user_today("Asia/Manila") - timedelta(days=1)),
        }
    )

    body = (await _quick_add(client, w, w.mark)).json()

    assert body["assignee_id"] is None
    assert body["project_id"] is None
    assert body["labels"] == ["Billing"]
    assert len(body["warnings"]) == 4
    assert any("assignee" in warning for warning in body["warnings"])
    assert any("Nonexistent" in warning for warning in body["warnings"])
    assert any("past" in warning for warning in body["warnings"])


async def test_default_project_is_used_when_the_sentence_names_none(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply({"title": "Fix footer"}, {"title": "Fix footer"})

    usable = await _quick_add(client, w, w.mark, default_project_id=str(w.website.id))
    not_usable = await _quick_add(client, w, w.mark, default_project_id=str(w.secret.id))

    assert usable.json()["project_id"] == str(w.website.id)
    assert not_usable.json()["project_id"] is None


async def test_invalid_json_twice_returns_ai_unavailable(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply("Sure! Here is your task:", {"priority": "urgent"})  # no title

    response = await _quick_add(client, w, w.mark)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert len(fake_ai.calls) == 2


async def test_viewers_cannot_use_ai(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)

    response = await _quick_add(client, w, w.vic)

    assert response.status_code == 403
    assert fake_ai.calls == []


async def test_51st_call_in_a_day_returns_ai_daily_limit(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    for _ in range(50):
        fake_ai.reply({"title": "Task"})
    for _ in range(50):
        assert (await _quick_add(client, w, w.mark)).status_code == 200

    response = await _quick_add(client, w, w.mark)

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "AI_DAILY_LIMIT"
    assert len(fake_ai.calls) == 50


async def test_confirmed_draft_is_saved_with_ai_source(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session, client)

    response = await client.post(
        f"/api/v1/projects/{w.website.id}/tasks",
        json={"title": "Send invoice", "source": "ai_quick_add"},
        headers=auth_headers(w.mark),
    )
    spoofed = await client.post(
        f"/api/v1/projects/{w.website.id}/tasks",
        json={"title": "Send invoice", "source": "import"},
        headers=auth_headers(w.mark),
    )

    assert response.json()["source"] == "ai_quick_add"
    assert spoofed.status_code == 400  # intake/import sources are server-only


async def test_usage_counts_todays_personal_ai_calls(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    w = await _world(db_session, client)
    fake_ai.reply({"title": "Task"})
    fake_ai.reply({"title": "Task"})
    await _quick_add(client, w, w.mark)
    await _quick_add(client, w, w.mark)

    mine = await client.get("/api/v1/ai/usage", headers=auth_headers(w.mark))
    theirs = await client.get("/api/v1/ai/usage", headers=auth_headers(w.owner))

    assert mine.json() == {"used": 2, "limit": 50}
    assert theirs.json() == {"used": 0, "limit": 50}
    assert (await client.get("/api/v1/ai/usage")).status_code == 401

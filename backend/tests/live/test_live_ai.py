"""Calls the real Groq API. Not run by default or in CI.

Run manually with:  uv run pytest -m live_ai
Needs GROQ_API_KEY (and optionally AI_MODEL) in backend/.env.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import MemberRole
from app.services.dates import user_today
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace

pytestmark = [
    pytest.mark.live_ai,
    pytest.mark.skipif(get_settings().groq_api_key is None, reason="GROQ_API_KEY not set"),
]


async def test_quick_add_against_the_real_model(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db_session, owner)
    mark = await add_member(db_session, workspace, "mark@example.com", MemberRole.member)
    project = await create_project(db_session, workspace, [owner, mark], name="Acme Website")

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/ai/quick-add",
        json={"text": "Ask Mark to send the Acme invoice by Friday, high priority"},
        headers=auth_headers(owner),
    )

    assert response.status_code == 200, response.text
    draft = response.json()
    print("\nLIVE DRAFT:", draft)
    assert draft["assignee_id"] == str(mark.id)
    assert draft["priority"] == "high"
    assert draft["due_date"] is not None and draft["due_date"] >= str(user_today("Asia/Manila"))
    assert "invoice" in draft["title"].lower()
    assert draft["project_id"] in (str(project.id), None)


async def test_subtasks_against_the_real_model(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db_session, owner)
    project = await create_project(db_session, workspace, [owner], name="Acme Website")
    task = (
        await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            json={
                "title": "Launch the new Acme homepage",
                "description": "New hero copy, updated photos, contact form must work on mobile.",
            },
            headers=auth_headers(owner),
        )
    ).json()

    response = await client.post(
        f"/api/v1/tasks/{task['id']}/ai/subtasks", headers=auth_headers(owner)
    )

    assert response.status_code == 200, response.text
    subtasks = response.json()["subtasks"]
    print("\nLIVE SUBTASKS:", subtasks)
    assert 3 <= len(subtasks) <= 8
    assert all(0 < len(s) <= 120 for s in subtasks)


async def test_thread_summary_against_the_real_model(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db_session, owner)
    mark = await add_member(db_session, workspace, "mark@example.com", MemberRole.member)
    project = await create_project(db_session, workspace, [owner, mark], name="Acme Website")
    task = (
        await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            json={"title": "Send the Acme invoice"},
            headers=auth_headers(owner),
        )
    ).json()
    thread = [
        (owner, "Can you send the Acme invoice this week?"),
        (mark, "Sure. Do we bill the old rate or the new one?"),
        (owner, "New rate, it was approved on Monday."),
        (mark, "Got it. I still need the PO number from Acme."),
        (owner, "I'll ask their finance team today."),
        (mark, "Thanks. I'll send it Friday once I have the PO."),
    ]
    for author, body in thread:
        await client.post(
            f"/api/v1/tasks/{task['id']}/comments",
            json={"body": body},
            headers=auth_headers(author),
        )

    response = await client.post(
        f"/api/v1/tasks/{task['id']}/ai/summary", headers=auth_headers(owner)
    )

    assert response.status_code == 200, response.text
    summary = response.json()
    print("\nLIVE SUMMARY:", {k: summary[k] for k in ("decisions", "open_questions", "next_steps")})
    words = sum(
        len(point.split())
        for key in ("decisions", "open_questions", "next_steps")
        for point in summary[key]
    )
    assert words < 80
    assert summary["next_steps"]


async def test_digest_summary_against_the_real_model(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="owner@example.com", name="Olive Reyes")
    workspace = await create_workspace(db_session, owner)
    project = await create_project(db_session, workspace, [owner], name="Acme Website")
    today = user_today("Asia/Manila")
    for title, offset in [
        ("Send the Acme invoice", -2),
        ("Approve homepage copy", 0),
        ("Book the photo shoot", 1),
    ]:
        await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            json={
                "title": title,
                "due_date": str(today + timedelta(days=offset)),
                "assignee_id": str(owner.id),
            },
            headers=auth_headers(owner),
        )

    response = await client.get(
        f"/api/v1/workspaces/{workspace.id}/digest/today", headers=auth_headers(owner)
    )

    assert response.status_code == 200, response.text
    summary = response.json()["summary"]
    print("\nLIVE DIGEST:", summary)
    assert summary is not None
    assert len(summary.split()) <= 60

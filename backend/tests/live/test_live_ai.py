"""Calls the real Groq API. Not run by default or in CI.

Run manually with:  uv run pytest -m live_ai
Needs GROQ_API_KEY (and optionally AI_MODEL) in backend/.env.
"""

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

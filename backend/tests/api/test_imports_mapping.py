import json
from pathlib import Path
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, User, Workspace
from tests.factories import add_member, auth_headers, create_user, create_workspace
from tests.fakes import FakeProvider

SAMPLE = Path(__file__).resolve().parents[3] / "scripts" / "samples" / "messy_tasks.xlsx"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# What a good model returns for the sample file (only the first 10 rows were sent).
AI_MAPPING = {
    "columns": {
        "Task Name": "title",
        "Notes": "description",
        "Owner": "assignee",
        "State": "status",
        "Prio": "priority",
        "Deadline": "due_date",
        "Tags": "labels",
        "Internal ID": "ignore",
    },
    "status_values": {"WIP": "in_progress", "Open": "todo", "Closed": "done"},
    "priority_values": {"P1": "urgent", "P2": "high", "P3": "medium"},
    "date_format": "%m/%d/%Y",
}


async def _upload(
    client: AsyncClient, workspace: Workspace, user: User, sheet: str | None = None
) -> Any:
    return await client.post(
        f"/api/v1/workspaces/{workspace.id}/imports",
        files={"file": ("messy_tasks.xlsx", SAMPLE.read_bytes(), XLSX)},
        data={"sheet": sheet} if sheet else {},
        headers=auth_headers(user),
    )


async def _owner_workspace(db: AsyncSession) -> tuple[Workspace, User]:
    owner = await create_user(db, email="owner@example.com", name="Olive Reyes")
    return await create_workspace(db, owner), owner


async def test_upload_parses_the_file_and_lists_sheets(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    workspace, owner = await _owner_workspace(db_session)

    response = await _upload(client, workspace, owner)

    job = response.json()
    assert response.status_code == 201
    assert job["status"] == "uploaded"
    assert job["sheet_names"] == ["Tasks export", "Read me"]
    assert job["total_rows"] == 9
    assert job["headers"][0] == "Task Name"
    assert set(job["column_values"]["State"]) == {
        "WIP",
        "Open",
        "todo",
        "Review",
        "Closed",
        "Blocked",
        "Done",
        "Cancelled",
    }


async def test_only_admins_can_import(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner = await _owner_workspace(db_session)
    member = await add_member(db_session, workspace, "mark@example.com", MemberRole.member)
    job = (await _upload(client, workspace, owner)).json()

    upload = await _upload(client, workspace, member)
    peek = await client.get(f"/api/v1/imports/{job['id']}", headers=auth_headers(member))
    stranger = await create_user(db_session, email="stranger@example.com")
    outside = await client.get(f"/api/v1/imports/{job['id']}", headers=auth_headers(stranger))

    assert upload.status_code == 403
    assert peek.status_code == 403
    assert outside.status_code == 404


async def test_rejects_other_file_types(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner = await _owner_workspace(db_session)

    response = await client.post(
        f"/api/v1/workspaces/{workspace.id}/imports",
        files={"file": ("tasks.exe", b"MZ...", "application/octet-stream")},
        headers=auth_headers(owner),
    )

    assert response.status_code == 400


async def test_ai_mapping_sees_only_headers_and_first_10_rows(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    workspace, owner = await _owner_workspace(db_session)
    job = (await _upload(client, workspace, owner)).json()
    fake_ai.reply(AI_MAPPING)

    response = await client.post(
        f"/api/v1/imports/{job['id']}/mapping", headers=auth_headers(owner)
    )

    assert response.status_code == 200
    sent = json.loads(fake_ai.calls[0].messages[0].content)
    assert sent["HEADERS"] == job["headers"]
    assert len(sent["SAMPLE_ROWS"]) <= 10
    mapping = response.json()["mapping"]
    assert mapping["columns"]["Task Name"] == "title"
    assert mapping["columns"]["Internal ID"] == "ignore"
    # Values the AI didn't map are filled in when they're obvious...
    assert mapping["status_values"]["Done"] == "done"
    assert mapping["status_values"]["Review"] == "in_review"
    assert mapping["priority_values"]["URGENT"] == "urgent"
    # ...and left for the user when they aren't.
    assert "Blocked" not in mapping["status_values"]
    assert response.json()["status"] == "mapped"


async def test_ai_cannot_invent_columns_or_reuse_fields(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    workspace, owner = await _owner_workspace(db_session)
    job = (await _upload(client, workspace, owner)).json()
    fake_ai.reply(
        {
            "columns": {"Task Name": "title", "Notes": "title", "Made Up": "labels"},
            "status_values": {},
            "priority_values": {},
            "date_format": None,
        }
    )

    mapping = (
        await client.post(f"/api/v1/imports/{job['id']}/mapping", headers=auth_headers(owner))
    ).json()["mapping"]

    assert mapping["columns"]["Task Name"] == "title"
    assert mapping["columns"]["Notes"] == "ignore"
    assert "Made Up" not in mapping["columns"]
    assert mapping["columns"]["Owner"] == "ignore"  # unmapped headers default to ignore


async def test_user_can_edit_the_mapping(client: AsyncClient, db_session: AsyncSession) -> None:
    workspace, owner = await _owner_workspace(db_session)
    job = (await _upload(client, workspace, owner)).json()
    path = f"/api/v1/imports/{job['id']}/mapping"
    headers = auth_headers(owner)

    ok = await client.put(path, json={**AI_MAPPING, "date_format": "%d/%m/%Y"}, headers=headers)
    two_titles = await client.put(
        path,
        json={**AI_MAPPING, "columns": {"Task Name": "title", "Notes": "title"}},
        headers=headers,
    )
    bad_format = await client.put(
        path, json={**AI_MAPPING, "date_format": "{__import__('os')}"}, headers=headers
    )
    unknown_column = await client.put(
        path, json={**AI_MAPPING, "columns": {"Nope": "title"}}, headers=headers
    )

    assert ok.json()["mapping"]["date_format"] == "%d/%m/%Y"
    assert two_titles.status_code == 400
    assert bad_format.status_code == 400
    assert unknown_column.status_code == 400


async def test_known_values_override_a_wrong_ai_answer(
    client: AsyncClient, db_session: AsyncSession, fake_ai: FakeProvider
) -> None:
    """Seen in a live run: the model mapped P2 to medium and P3 to high, and gave no
    date format for dates like 11/05/2026."""
    workspace, owner = await _owner_workspace(db_session)
    job = (await _upload(client, workspace, owner)).json()
    fake_ai.reply(
        {
            **AI_MAPPING,
            "priority_values": {"P1": "urgent", "P2": "medium", "P3": "high", "Blah": "low"},
            "date_format": None,
        }
    )

    mapping = (
        await client.post(f"/api/v1/imports/{job['id']}/mapping", headers=auth_headers(owner))
    ).json()["mapping"]

    assert mapping["priority_values"]["P2"] == "high"
    assert mapping["priority_values"]["P3"] == "medium"
    assert mapping["priority_values"]["Blah"] == "low"  # unknown words keep the AI's answer
    assert mapping["date_format"] is not None  # inferred from the Deadline column

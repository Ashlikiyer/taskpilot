from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ImportJob, Label, MemberRole, Project, Task, User, Workspace
from app.repositories import activity as activity_repo
from tests.api.test_imports_mapping import AI_MAPPING, SAMPLE, XLSX
from tests.factories import add_member, auth_headers, create_project, create_user, create_workspace


@dataclass
class World:
    workspace: Workspace
    project: Project
    owner: User
    mark: User
    nina: User  # workspace member, not on the project


async def _world(db: AsyncSession) -> World:
    owner = await create_user(db, email="olive@example.com", name="Olive Reyes")
    workspace = await create_workspace(db, owner)
    mark = await add_member(db, workspace, "mark@example.com", MemberRole.member)
    mark.name = "Mark Santos"
    ana = await add_member(db, workspace, "ana@example.com", MemberRole.member)
    ana.name = "Ana Cruz"
    nina = await add_member(db, workspace, "nina@example.com", MemberRole.member)
    nina.name = "Nina Lim"
    project = await create_project(db, workspace, [owner, mark, ana], name="Acme Website")
    return World(workspace, project, owner, mark, nina)


async def _mapped_job(client: AsyncClient, w: World, mapping: dict[str, Any] = AI_MAPPING) -> str:
    headers = auth_headers(w.owner)
    job = (
        await client.post(
            f"/api/v1/workspaces/{w.workspace.id}/imports",
            files={"file": ("messy_tasks.xlsx", SAMPLE.read_bytes(), XLSX)},
            headers=headers,
        )
    ).json()
    response = await client.put(
        f"/api/v1/imports/{job['id']}/mapping", json=mapping, headers=headers
    )
    assert response.status_code == 200, response.text
    job_id: str = job["id"]
    return job_id


async def _post(client: AsyncClient, w: World, job_id: str, step: str, **options: Any) -> Any:
    return await client.post(
        f"/api/v1/imports/{job_id}/{step}",
        json={"project_id": str(w.project.id), **options},
        headers=auth_headers(w.owner),
    )


def _issues(row: dict[str, Any], level: str) -> list[str]:
    return [i["field"] for i in row["issues"] if i["level"] == level]


async def _count(db: AsyncSession, model: type) -> int:
    return await db.scalar(select(func.count()).select_from(model)) or 0


async def test_messy_sample_file_maps_correctly(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Spec must-have: the messy sample file maps correctly."""
    w = await _world(db_session)
    job_id = await _mapped_job(client, w)

    preview = (await _post(client, w, job_id, "preview")).json()

    rows = {row["row_number"]: row for row in preview["rows"]}
    assert set(rows) == {2, 3, 4, 6, 7, 8, 9, 10, 12}  # real spreadsheet rows; blanks gone
    first = rows[2]
    assert (first["title"], first["status"], first["priority"]) == (
        "Send the Acme invoice",
        "in_progress",
        "urgent",
    )
    assert first["assignee_name"] == "Mark Santos"  # matched by email
    assert first["due_date"] == "2026-11-03"
    assert first["labels"] == ["Billing", "Client"]
    assert rows[3]["due_date"] == "2026-11-05"  # 11/05/2026 with %m/%d/%Y
    assert rows[3]["assignee_name"] == "Mark Santos"  # matched by full name
    assert rows[4]["assignee_name"] == "Ana Cruz"  # unique first name "ana"
    assert rows[4]["due_date"] == "2026-11-07"  # Excel date cell
    assert rows[6]["assignee_name"] is None and "assignee" in _issues(rows[6], "warning")  # Mrak
    assert rows[6]["due_date"] == "2026-11-10"  # "Nov 10, 2026"
    assert rows[7]["status"] == "done"  # Closed
    assert "due_date" in _issues(rows[7], "warning")  # "soon-ish"
    assert _issues(rows[8], "error") == ["title"]  # no title
    assert "assignee" in _issues(rows[9], "warning")  # someone@else.com
    assert "status" in _issues(rows[9], "warning")  # "Blocked" isn't mapped
    assert len(rows[10]["title"]) == 200 and "title" in _issues(rows[10], "warning")
    # "P4" isn't in this hand-made mapping: spec rule, warning and Medium.
    assert rows[12]["priority"] == "medium"
    assert "priority" in _issues(rows[12], "warning")
    assert set(preview["new_labels"]) == {"Billing", "Client", "Website", "Bug", "Marketing"}
    assert preview["total_rows"] == 9
    assert preview["rows_with_errors"] == 1
    assert preview["valid_rows"] == 8
    assert await _count(db_session, Task) == 0  # a preview never saves


async def test_import_skips_error_rows_and_saves_the_rest(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Spec must-have: error rows are skipped."""
    w = await _world(db_session)
    job_id = await _mapped_job(client, w)

    result = (await _post(client, w, job_id, "run")).json()

    assert result["imported_rows"] == 8
    [skipped] = result["skipped_rows"]
    assert skipped["row_number"] == 8
    assert skipped["values"]["Notes"] == "Row with no title"
    assert skipped["reasons"] == ["Missing title, so this row is skipped."]
    assert set(result["labels_created"]) == {"Billing", "Client", "Website", "Bug", "Marketing"}

    tasks = (await db_session.execute(select(Task).order_by(Task.position))).scalars().all()
    assert {t.source for t in tasks} == {"import"}
    invoice = next(t for t in tasks if t.title == "Send the Acme invoice")
    assert invoice.assignee_id == w.mark.id
    assert invoice.due_date == date(2026, 11, 3)
    closed = next(t for t in tasks if t.title == "Fix contact form")
    assert closed.completed_at is not None
    todo_titles = [t.title for t in tasks if t.status.value == "todo"]
    assert todo_titles[:2] == ["Update pricing page", "Book the photo shoot"]  # file order
    board = await client.get(
        f"/api/v1/projects/{w.project.id}/tasks?status=todo", headers=auth_headers(w.owner)
    )
    assert board.json()["items"][0]["labels"][0]["name"] == "Website"


async def test_import_is_all_or_nothing_on_a_database_error(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Spec must-have: the import is all-or-nothing when the database fails mid-way."""
    w = await _world(db_session)
    job_id = await _mapped_job(client, w)
    labels_before = await _count(db_session, Label)

    async def broken(*_: Any, **__: Any) -> None:
        raise RuntimeError("database went away")

    monkeypatch.setattr(activity_repo, "add", broken)  # fails after tasks were flushed
    response = await _post(client, w, job_id, "run")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "IMPORT_FAILED"
    assert await _count(db_session, Task) == 0
    assert await _count(db_session, Label) == labels_before  # new labels rolled back too
    job = await db_session.get(ImportJob, job_id)
    assert job is not None
    await db_session.refresh(job)
    assert job.status == "failed"


async def test_assignee_must_be_on_the_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    mapping = {**AI_MAPPING}
    job_id = await _mapped_job(client, w, mapping)
    # Point row 2's owner at Nina, who is in the workspace but not on this project.
    job = await db_session.get(ImportJob, job_id)
    assert job is not None
    rows = [list(r) for r in job.rows]
    rows[0][2] = "nina@example.com"
    job.rows = rows
    await db_session.flush()

    preview = (await _post(client, w, job_id, "preview")).json()

    first = preview["rows"][0]
    assert first["assignee_name"] is None
    assert any("isn't on this project" in i["message"] for i in first["issues"])


async def test_duplicates_are_warned_or_skipped(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    await client.post(
        f"/api/v1/projects/{w.project.id}/tasks",
        json={"title": "send the acme INVOICE", "due_date": "2026-11-03"},
        headers=auth_headers(w.owner),
    )
    job_id = await _mapped_job(client, w)

    allowed = (await _post(client, w, job_id, "preview")).json()
    blocked = (await _post(client, w, job_id, "preview", allow_duplicates=False)).json()

    assert "title" in _issues(allowed["rows"][0], "warning")
    assert "title" in _issues(blocked["rows"][0], "error")
    assert blocked["rows_with_errors"] == 2


async def test_an_import_runs_only_once(client: AsyncClient, db_session: AsyncSession) -> None:
    w = await _world(db_session)
    job_id = await _mapped_job(client, w)

    first = await _post(client, w, job_id, "run")
    again = await _post(client, w, job_id, "run")
    remap = await client.put(
        f"/api/v1/imports/{job_id}/mapping", json=AI_MAPPING, headers=auth_headers(w.owner)
    )

    assert first.status_code == 200
    assert again.status_code == 409
    assert remap.status_code == 409
    assert await _count(db_session, Task) == 8


async def test_needs_a_title_column_and_an_active_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    no_title = {**AI_MAPPING, "columns": {**AI_MAPPING["columns"], "Task Name": "ignore"}}  # type: ignore[dict-item]
    job_id = await _mapped_job(client, w, no_title)

    missing_title = await _post(client, w, job_id, "preview")
    w.project.archived_at = datetime.now(UTC)
    await db_session.flush()
    good_job = await _mapped_job(client, w)
    archived = await _post(client, w, good_job, "preview")

    assert missing_title.status_code == 400
    assert archived.status_code == 409


async def test_cannot_import_into_another_workspaces_project(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    w = await _world(db_session)
    stranger = await create_user(db_session, email="stranger@example.com")
    other_ws = await create_workspace(db_session, stranger, slug="other")
    other_project = await create_project(db_session, other_ws, [stranger], name="Secret")
    job_id = await _mapped_job(client, w)

    response = await client.post(
        f"/api/v1/imports/{job_id}/run",
        json={"project_id": str(other_project.id)},
        headers=auth_headers(w.owner),
    )

    assert response.status_code == 404
    assert await _count(db_session, Task) == 0

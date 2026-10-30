"""F11 smart import: upload → AI-suggested mapping (editable) → dry-run preview → import.

Nothing is written to the tasks table until the user runs the import, and the run
re-checks every row instead of trusting an earlier preview.
"""

import json
import logging
import uuid
from dataclasses import dataclass

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ConflictError, NotFoundError
from app.db.models import ImportJob, ImportStatus, MemberRole, User
from app.repositories import imports as imports_repo
from app.schemas.imports import ImportJobOut, ImportMapping
from app.services import workspaces as workspaces_service
from app.services.ai import prompts
from app.services.ai.provider import AIProvider
from app.services.ai.runner import run_json
from app.services.import_files import MAX_BYTES, read_table
from app.services.import_values import best_date_format, guess_priority, guess_status
from app.services.workspaces import WorkspaceContext

logger = logging.getLogger(__name__)

AI_SAMPLE_ROWS = 10  # the spec sends the headers and the first 10 rows only
MAX_DISTINCT_VALUES = 50
SINGLE_TARGETS = ("title", "description", "status", "priority", "assignee", "due_date", "labels")


@dataclass(frozen=True)
class ImportContext:
    job: ImportJob
    workspace: WorkspaceContext


def _not_found() -> NotFoundError:
    return NotFoundError("Import not found", code="IMPORT_NOT_FOUND")


def _validation(message: str) -> AppError:
    return AppError(400, "VALIDATION_ERROR", message)


def distinct_values(
    job: ImportJob, header: str, limit: int | None = MAX_DISTINCT_VALUES
) -> list[str]:
    index = job.headers.index(header)
    seen: dict[str, None] = {}
    for row in job.rows:
        value = row[index]
        if value is not None and value not in seen:
            seen[value] = None
            if limit is not None and len(seen) >= limit:
                break
    return list(seen)


def to_out(job: ImportJob) -> ImportJobOut:
    return ImportJobOut.model_validate(
        {
            "id": job.id,
            "workspace_id": job.workspace_id,
            "project_id": job.project_id,
            "file_name": job.file_name,
            "sheet_name": job.sheet_name,
            "sheet_names": job.sheet_names,
            "headers": job.headers,
            "sample_rows": job.rows[:AI_SAMPLE_ROWS],
            "column_values": {h: distinct_values(job, h) for h in job.headers},
            "total_rows": job.total_rows,
            "status": job.status,
            "mapping": job.mapping,
            "imported_rows": job.imported_rows,
            "created_at": job.created_at,
        }
    )


async def get_context(db: AsyncSession, job_id: uuid.UUID, user: User) -> ImportContext:
    """Outsiders get 404; only admins and owners may import (spec permission matrix)."""
    job = await imports_repo.get_by_id(db, job_id)
    if job is None:
        raise _not_found()
    try:
        workspace = await workspaces_service.get_context(db, job.workspace_id, user)
    except NotFoundError:
        raise _not_found() from None
    workspace.require(MemberRole.admin)
    return ImportContext(job=job, workspace=workspace)


async def upload(
    db: AsyncSession, ctx: WorkspaceContext, file: UploadFile, sheet: str | None
) -> ImportJobOut:
    ctx.require(MemberRole.admin)
    content = await file.read(MAX_BYTES + 1)  # never read more than the limit allows
    parsed = read_table(file.filename or "upload", content, sheet)
    job = await imports_repo.add(
        db,
        ImportJob(
            workspace_id=ctx.workspace.id,
            created_by=ctx.user.id,
            file_name=(file.filename or "upload")[:255],
            sheet_name=parsed.sheet,
            sheet_names=parsed.sheet_names,
            headers=parsed.headers,
            rows=parsed.rows,
            row_numbers=parsed.row_numbers,
            total_rows=len(parsed.rows),
        ),
    )
    await db.commit()
    return to_out(job)


def require_editable(job: ImportJob) -> None:
    if job.status in (ImportStatus.imported.value, ImportStatus.failed.value):
        raise ConflictError("This import has already run. Start a new one to import again.")


def check_mapping(job: ImportJob, mapping: ImportMapping) -> ImportMapping:
    """Every header mapped once, each field used at most once, and a title column."""
    unknown = set(mapping.columns) - set(job.headers)
    if unknown:
        raise _validation(f"These columns aren't in the file: {', '.join(sorted(unknown))}")
    columns = {header: mapping.columns.get(header, "ignore") for header in job.headers}
    for target in SINGLE_TARGETS:
        used = [h for h, t in columns.items() if t == target]
        if len(used) > 1:
            raise _validation(f'Only one column can be "{target}"; you chose {", ".join(used)}.')
    return mapping.model_copy(update={"columns": columns})


def _fill_value_maps(job: ImportJob, mapping: ImportMapping) -> ImportMapping:
    """Apply what code knows for sure on top of the AI's suggestion.

    Well-known words ("P2", "WIP", "Closed") always get their standard meaning, even
    if the AI said otherwise (in testing it once mapped P2 to Medium and P3 to High).
    The AI's answer is kept for everything else, and values it never saw (outside the
    first 10 rows) get the standard meaning when there is one. If the AI gave no date
    format, the format that reads the most dates in the column is used.
    """
    status_values = dict(mapping.status_values)
    priority_values = dict(mapping.priority_values)
    date_format = mapping.date_format
    for header, target in mapping.columns.items():
        if target == "status":
            for value in distinct_values(job, header, limit=None):
                if (status := guess_status(value)) is not None:
                    status_values[value] = status
        elif target == "priority":
            for value in distinct_values(job, header, limit=None):
                if (priority := guess_priority(value)) is not None:
                    priority_values[value] = priority
        elif target == "due_date" and date_format is None:
            date_format = best_date_format(distinct_values(job, header, limit=None))
    return mapping.model_copy(
        update={
            "status_values": status_values,
            "priority_values": priority_values,
            "date_format": date_format,
        }
    )


async def suggest_mapping(
    db: AsyncSession, ctx: ImportContext, provider: AIProvider
) -> ImportJobOut:
    job = ctx.job
    require_editable(job)
    context = {"HEADERS": job.headers, "SAMPLE_ROWS": job.rows[:AI_SAMPLE_ROWS]}
    suggestion = await run_json(
        db,
        provider,
        user=ctx.workspace.user,
        workspace_id=job.workspace_id,
        feature="import_mapping",
        system=prompts.IMPORT_MAPPING,
        prompt=json.dumps(context, ensure_ascii=False),
        schema=ImportMapping,
    )
    # The AI may invent headers or reuse a field; keep only what makes sense.
    columns = {h: t for h, t in suggestion.columns.items() if h in job.headers}
    used: set[str] = set()
    for header, target in list(columns.items()):
        if target != "ignore" and target in used:
            columns[header] = "ignore"
        used.add(target)
    mapping = _fill_value_maps(
        job, check_mapping(job, suggestion.model_copy(update={"columns": columns}))
    )
    job.mapping = mapping.model_dump(mode="json")
    job.status = ImportStatus.mapped.value
    await db.commit()
    return to_out(job)


async def set_mapping(db: AsyncSession, ctx: ImportContext, mapping: ImportMapping) -> ImportJobOut:
    job = ctx.job
    require_editable(job)
    checked = check_mapping(job, mapping)
    job.mapping = checked.model_dump(mode="json")
    job.status = ImportStatus.mapped.value
    await db.commit()
    return to_out(job)

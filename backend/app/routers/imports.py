from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from app.core.deps import AI, AnyMember, DbSession, ImportAccess
from app.schemas.imports import (
    ImportJobOut,
    ImportMapping,
    ImportOptions,
    ImportResult,
    PreviewResult,
)
from app.services import import_run
from app.services import imports as imports_service

router = APIRouter(tags=["imports"])


@router.post("/workspaces/{ws_id}/imports", status_code=status.HTTP_201_CREATED)
async def upload_import(
    db: DbSession,
    ctx: AnyMember,
    file: Annotated[UploadFile, File(description=".csv or .xlsx, max 5 MB, 2,000 rows")],
    sheet: Annotated[str | None, Form(max_length=100)] = None,
) -> ImportJobOut:
    """Step 1: upload. Admins only. Pick an Excel sheet with `sheet` (default: the first)."""
    return await imports_service.upload(db, ctx, file, sheet)


@router.get("/imports/{job_id}")
async def get_import(ctx: ImportAccess) -> ImportJobOut:
    return imports_service.to_out(ctx.job)


@router.post("/imports/{job_id}/mapping")
async def suggest_mapping(db: DbSession, ctx: ImportAccess, provider: AI) -> ImportJobOut:
    """Step 2: the AI suggests a column and value mapping from the headers and first 10 rows."""
    return await imports_service.suggest_mapping(db, ctx, provider)


@router.put("/imports/{job_id}/mapping")
async def set_mapping(data: ImportMapping, db: DbSession, ctx: ImportAccess) -> ImportJobOut:
    """Step 2: the user confirms or edits the mapping."""
    return await imports_service.set_mapping(db, ctx, data)


@router.post("/imports/{job_id}/preview")
async def preview_import(data: ImportOptions, db: DbSession, ctx: ImportAccess) -> PreviewResult:
    """Step 3: dry run. Checks every row; nothing is saved."""
    return await import_run.preview(db, ctx, data)


@router.post("/imports/{job_id}/run")
async def run_import(data: ImportOptions, db: DbSession, ctx: ImportAccess) -> ImportResult:
    """Step 4: import valid rows into the project in one transaction (all or nothing)."""
    return await import_run.run(db, ctx, data)

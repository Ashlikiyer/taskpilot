from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, Request, status

from app.core.config import get_settings
from app.core.deps import AI, DbSession, IntakeAccess, ProjectAccess
from app.core.errors import AppError
from app.core.rate_limit import limiter
from app.core.security import secrets_match
from app.db.models import IntakeStatus
from app.schemas.intake import (
    EmailIntake,
    EmailIntakeResult,
    IntakeAccept,
    IntakeFormInfo,
    IntakeFormSubmission,
    IntakeItemOut,
)
from app.services import intake as intake_service

router = APIRouter(tags=["intake"])


def require_intake_secret(
    x_intake_secret: Annotated[str | None, Header(max_length=200)] = None,
) -> None:
    if not secrets_match(x_intake_secret, get_settings().intake_secret):
        raise AppError(401, "UNAUTHENTICATED", "Invalid intake secret")


@router.post("/intake/email", dependencies=[Depends(require_intake_secret)])
async def receive_email(data: EmailIntake, db: DbSession, provider: AI) -> EmailIntakeResult:
    """Webhook for the Gmail Apps Script. The same message is never processed twice."""
    return await intake_service.receive_email(db, provider, data)


@router.get("/intake/form/{slug}")
async def form_info(slug: str, db: DbSession) -> IntakeFormInfo:
    """Public: the project and workspace names for the request form."""
    return await intake_service.form_info(db, slug)


@router.post("/intake/form/{slug}", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/hour")
async def submit_form(
    request: Request, slug: str, data: IntakeFormSubmission, db: DbSession, provider: AI
) -> dict[str, bool]:
    """Public request form (no login). Rate limited to 10 per hour per IP."""
    await intake_service.submit_form(db, provider, slug, data)
    return {"received": True}


@router.get("/projects/{project_id}/intake")
async def list_intake(
    db: DbSession, ctx: ProjectAccess, status: IntakeStatus | None = IntakeStatus.pending
) -> list[IntakeItemOut]:
    """Inbox items for admins; pending by default."""
    return await intake_service.list_items(db, ctx, status)


@router.post("/intake/{item_id}/accept")
async def accept_item(
    db: DbSession, ctx: IntakeAccess, edits: Annotated[IntakeAccept | None, Body()] = None
) -> IntakeItemOut:
    """Create a task from the proposal, with optional edits made in the Inbox."""
    return await intake_service.accept(db, ctx, edits or IntakeAccept())


@router.post("/intake/{item_id}/reject")
async def reject_item(db: DbSession, ctx: IntakeAccess) -> IntakeItemOut:
    return await intake_service.reject(db, ctx)

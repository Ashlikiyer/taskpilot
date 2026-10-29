import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header

from app.core.config import get_settings
from app.core.deps import AI, DbSession, require_role
from app.core.errors import AppError
from app.db.models import MemberRole
from app.schemas.digest import DigestOut, DigestRunResult
from app.services import digest as digest_service
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["digest"])

Member = Annotated[WorkspaceContext, Depends(require_role(MemberRole.member))]


@router.get("/workspaces/{ws_id}/digest/today")
async def digest_today(db: DbSession, ctx: Member, provider: AI) -> DigestOut:
    """Today's digest for the current user in this workspace (built on first view)."""
    return await digest_service.today_for(db, ctx, provider)


def require_cron_secret(
    x_cron_secret: Annotated[str | None, Header(max_length=200)] = None,
) -> None:
    """Shared-secret check for the scheduled job, compared in constant time."""
    expected = get_settings().cron_secret
    if (
        expected is None
        or x_cron_secret is None
        or not hmac.compare_digest(x_cron_secret.encode(), expected.get_secret_value().encode())
    ):
        raise AppError(401, "UNAUTHENTICATED", "Invalid cron secret")


@router.post("/internal/digest/run", dependencies=[Depends(require_cron_secret)])
async def run_digest(db: DbSession, provider: AI) -> DigestRunResult:
    """Called by GitHub Actions every morning at 8:00 AM PHT. Idempotent."""
    return await digest_service.run_daily(db, provider)

import uuid

from fastapi import APIRouter

from app.core.deps import AnyMember, DbSession
from app.schemas.dashboard import DashboardOut
from app.services import dashboard as dashboard_service

router = APIRouter(tags=["dashboard"])


@router.get("/workspaces/{ws_id}/dashboard")
async def get_dashboard(
    db: DbSession, ctx: AnyMember, project_id: uuid.UUID | None = None
) -> DashboardOut:
    """Open tasks by status, overdue, completed per week (8 weeks) and workload."""
    return await dashboard_service.get_dashboard(db, ctx, project_id)

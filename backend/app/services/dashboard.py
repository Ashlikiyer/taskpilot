import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.db.models import TaskStatus
from app.repositories import dashboard as dashboard_repo
from app.repositories import projects as projects_repo
from app.schemas.dashboard import DashboardOut, MemberLoad, StatusCount, WeekCount
from app.services.dates import user_today
from app.services.workspaces import WorkspaceContext

WEEKS = 8
OPEN_STATUSES = (TaskStatus.todo, TaskStatus.in_progress, TaskStatus.in_review)


def _midnight(day: date, zone: str) -> datetime:
    return datetime.combine(day, time(0), tzinfo=ZoneInfo(zone)).astimezone(UTC)


async def get_dashboard(
    db: AsyncSession, ctx: WorkspaceContext, project_id: uuid.UUID | None
) -> DashboardOut:
    workspace_id = ctx.workspace.id
    if project_id is not None:
        project = await projects_repo.get_by_id(db, project_id)
        if project is None or project.workspace_id != workspace_id:
            raise NotFoundError("Project not found")

    zone = get_settings().app_timezone
    today = user_today(zone)
    this_monday = today - timedelta(days=today.weekday())
    weeks = [this_monday - timedelta(weeks=n) for n in range(WEEKS - 1, -1, -1)]
    since = _midnight(weeks[0], zone)
    week_ago = today - timedelta(days=7)

    by_status = await dashboard_repo.open_by_status(db, workspace_id, project_id)
    per_week = await dashboard_repo.completed_per_week(db, workspace_id, project_id, since, zone)
    created, by_ai = await dashboard_repo.created_since(db, workspace_id, project_id, since)

    return DashboardOut(
        today=today,
        project_id=project_id,
        open_total=sum(by_status.values()),
        open_projects=await dashboard_repo.open_project_count(db, workspace_id, project_id),
        open_by_status=[
            StatusCount(status=status.value, count=by_status.get(status, 0))
            for status in OPEN_STATUSES
        ],
        overdue=await dashboard_repo.overdue_count(db, workspace_id, project_id, today),
        overdue_week_ago=await dashboard_repo.overdue_count_at(
            db, workspace_id, project_id, week_ago, _midnight(week_ago, zone)
        ),
        completed_this_week=per_week.get(this_monday, 0),
        completed_per_week=[WeekCount(week_start=w, count=per_week.get(w, 0)) for w in weeks],
        workload=[
            MemberLoad(user_id=user_id, name=name, open=n)
            for user_id, name, n in await dashboard_repo.workload(db, workspace_id, project_id)
        ],
        created_recently=created,
        created_by_ai=by_ai,
    )

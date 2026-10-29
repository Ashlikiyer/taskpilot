from collections.abc import Sequence
from datetime import date, timedelta
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Task
from app.repositories import projects as projects_repo
from app.repositories import tasks as tasks_repo
from app.schemas.task import MyTasks, SearchResults
from app.services import projects as projects_service
from app.services import tasks as tasks_service
from app.services.dates import user_today
from app.services.workspaces import WorkspaceContext

TASK_RESULTS = 20
PROJECT_RESULTS = 10

DueGroup = Literal["overdue", "due_today", "this_week", "later", "no_date"]


async def search(db: AsyncSession, ctx: WorkspaceContext, text: str) -> SearchResults:
    """Tasks and projects matching the text; archived projects stay searchable."""
    tasks = await tasks_repo.search_in_workspace(db, ctx.workspace.id, text, limit=TASK_RESULTS)
    projects = await projects_repo.search_by_name(
        db, ctx.workspace.id, text.strip(), limit=PROJECT_RESULTS
    )
    return SearchResults(
        tasks=await tasks_service.to_outs(db, tasks),
        projects=await projects_service.to_outs(db, projects),
    )


def due_group(due: date | None, today: date) -> DueGroup:
    """Weeks run Monday to Sunday, so "this week" ends on Sunday."""
    if due is None:
        return "no_date"
    if due < today:
        return "overdue"
    if due == today:
        return "due_today"
    if due <= today + timedelta(days=6 - today.weekday()):
        return "this_week"
    return "later"


def group_by_due(tasks: Sequence[Task], today: date) -> dict[DueGroup, list[Task]]:
    groups: dict[DueGroup, list[Task]] = {
        "overdue": [],
        "due_today": [],
        "this_week": [],
        "later": [],
        "no_date": [],
    }
    for task in tasks:
        groups[due_group(task.due_date, today)].append(task)
    return groups


async def my_tasks(db: AsyncSession, ctx: WorkspaceContext) -> MyTasks:
    tasks = await tasks_repo.assigned_to_user(db, ctx.workspace.id, ctx.user.id)
    today = user_today(ctx.user.timezone)
    groups = group_by_due(tasks, today)
    return MyTasks(
        today=today,
        overdue=await tasks_service.to_outs(db, groups["overdue"]),
        due_today=await tasks_service.to_outs(db, groups["due_today"]),
        this_week=await tasks_service.to_outs(db, groups["this_week"]),
        later=await tasks_service.to_outs(db, groups["later"]),
        no_date=await tasks_service.to_outs(db, groups["no_date"]),
    )

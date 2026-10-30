"""Aggregate queries for the dashboard. Every query is scoped to one workspace's
active (not archived) projects, optionally one project, and top-level tasks."""

import uuid
from datetime import date, datetime

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Project, Task, TaskSource, TaskStatus, User, WorkspaceMember

AI_SOURCES = (TaskSource.ai_quick_add.value, TaskSource.intake.value, TaskSource.import_.value)


def _scope(workspace_id: uuid.UUID, project_id: uuid.UUID | None) -> list[ColumnElement[bool]]:
    conditions = [
        Task.project_id == Project.id,
        Project.workspace_id == workspace_id,
        Project.archived_at.is_(None),
        Task.parent_id.is_(None),
    ]
    if project_id is not None:
        conditions.append(Task.project_id == project_id)
    return conditions


async def open_by_status(
    db: AsyncSession, workspace_id: uuid.UUID, project_id: uuid.UUID | None
) -> dict[TaskStatus, int]:
    result = await db.execute(
        select(Task.status, func.count())
        .select_from(Task, Project)
        .where(*_scope(workspace_id, project_id), Task.status != TaskStatus.done)
        .group_by(Task.status)
    )
    return {status: count for status, count in result.all()}


async def open_project_count(
    db: AsyncSession, workspace_id: uuid.UUID, project_id: uuid.UUID | None
) -> int:
    return (
        await db.scalar(
            select(func.count(func.distinct(Task.project_id)))
            .select_from(Task, Project)
            .where(*_scope(workspace_id, project_id), Task.status != TaskStatus.done)
        )
        or 0
    )


async def overdue_count(
    db: AsyncSession, workspace_id: uuid.UUID, project_id: uuid.UUID | None, today: date
) -> int:
    return (
        await db.scalar(
            select(func.count())
            .select_from(Task, Project)
            .where(
                *_scope(workspace_id, project_id),
                Task.status != TaskStatus.done,
                Task.due_date < today,
            )
        )
        or 0
    )


async def overdue_count_at(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID | None,
    day: date,
    day_start: datetime,
) -> int:
    """How many tasks were overdue at the start of `day`, from completion times."""
    return (
        await db.scalar(
            select(func.count())
            .select_from(Task, Project)
            .where(
                *_scope(workspace_id, project_id),
                Task.due_date < day,
                Task.created_at < day_start,
                (Task.completed_at.is_(None)) | (Task.completed_at >= day_start),
            )
        )
        or 0
    )


async def completed_per_week(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    project_id: uuid.UUID | None,
    since: datetime,
    timezone: str,
) -> dict[date, int]:
    """Completed tasks grouped by the Monday of their week, in `timezone`."""
    week = func.date_trunc("week", func.timezone(timezone, Task.completed_at))
    result = await db.execute(
        select(week, func.count())
        .select_from(Task, Project)
        .where(
            *_scope(workspace_id, project_id),
            Task.status == TaskStatus.done,
            Task.completed_at >= since,
        )
        .group_by(week)
    )
    return {start.date(): count for start, count in result.all()}


async def workload(
    db: AsyncSession, workspace_id: uuid.UUID, project_id: uuid.UUID | None
) -> list[tuple[uuid.UUID, str, int]]:
    """Open tasks per current workspace member, most first."""
    count = func.count().label("open")
    result = await db.execute(
        select(User.id, User.name, count)
        .select_from(Task, Project)
        .join(User, User.id == Task.assignee_id)
        .join(
            WorkspaceMember,
            (WorkspaceMember.user_id == User.id) & (WorkspaceMember.workspace_id == workspace_id),
        )
        .where(*_scope(workspace_id, project_id), Task.status != TaskStatus.done)
        .group_by(User.id, User.name)
        .order_by(count.desc(), User.name)
    )
    return [(user_id, name, n) for user_id, name, n in result.all()]


async def created_since(
    db: AsyncSession, workspace_id: uuid.UUID, project_id: uuid.UUID | None, since: datetime
) -> tuple[int, int]:
    """(tasks created since `since`, of which from quick-add, intake or import)."""
    result = await db.execute(
        select(func.count(), func.count().filter(Task.source.in_(AI_SOURCES)))
        .select_from(Task, Project)
        .where(*_scope(workspace_id, project_id), Task.created_at >= since)
    )
    total, ai = result.one()
    return total, ai

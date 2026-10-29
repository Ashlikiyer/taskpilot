import uuid
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    ActivityLog,
    Digest,
    MemberRole,
    Project,
    Task,
    TaskStatus,
    User,
    Workspace,
    WorkspaceMember,
)


async def open_assigned_tasks(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> list[tuple[Task, str, datetime]]:
    """Open tasks assigned to the user in the workspace's active projects, with the
    project name and the time of the task's latest activity."""
    last_activity = (
        select(ActivityLog.task_id, func.max(ActivityLog.created_at).label("at"))
        .group_by(ActivityLog.task_id)
        .subquery()
    )
    result = await db.execute(
        select(Task, Project.name, func.coalesce(last_activity.c.at, Task.created_at))
        .join(Project, Project.id == Task.project_id)
        .outerjoin(last_activity, last_activity.c.task_id == Task.id)
        .where(
            Project.workspace_id == workspace_id,
            Project.archived_at.is_(None),
            Task.assignee_id == user_id,
            Task.status != TaskStatus.done,
        )
        .order_by(Task.due_date.asc().nulls_last(), Task.priority.desc(), Task.position)
    )
    return [(task, name, at) for task, name, at in result.all()]


async def members_to_digest(db: AsyncSession) -> list[tuple[Workspace, User]]:
    """Everyone who can be assigned tasks (viewers can't), in every workspace."""
    result = await db.execute(
        select(Workspace, User)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.role != MemberRole.viewer)
        .order_by(Workspace.id, User.id)
    )
    return [(workspace, user) for workspace, user in result.all()]


async def get(
    db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID, day: date
) -> Digest | None:
    result = await db.execute(
        select(Digest).where(
            Digest.user_id == user_id, Digest.workspace_id == workspace_id, Digest.date == day
        )
    )
    return result.scalar_one_or_none()


async def add(db: AsyncSession, digest: Digest) -> Digest:
    db.add(digest)
    await db.flush()
    await db.refresh(digest)
    return digest

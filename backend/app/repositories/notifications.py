import uuid
from datetime import date, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, NotificationType, Project, Task, TaskStatus, Workspace


async def add(db: AsyncSession, notifications: list[Notification]) -> None:
    db.add_all(notifications)
    await db.flush()


async def list_for_user(
    db: AsyncSession, user_id: uuid.UUID, *, unread_only: bool, limit: int
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    result = await db.execute(
        query.order_by(Notification.created_at.desc(), Notification.id).limit(limit)
    )
    return list(result.scalars())


async def unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
    )
    return count or 0


async def get_for_user(
    db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID
) -> Notification | None:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID, now: datetime) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )


async def tasks_due_on(db: AsyncSession, due: date) -> list[tuple[Task, str]]:
    """Open, assigned tasks due on `due` in active projects, with their workspace slug."""
    result = await db.execute(
        select(Task, Workspace.slug)
        .join(Project, Project.id == Task.project_id)
        .join(Workspace, Workspace.id == Project.workspace_id)
        .where(
            Task.due_date == due,
            Task.assignee_id.is_not(None),
            Task.status != TaskStatus.done,
            Project.archived_at.is_(None),
        )
    )
    return [(task, slug) for task, slug in result.all()]


async def due_tomorrow_already_sent(
    db: AsyncSession, user_id: uuid.UUID, task_id: uuid.UUID, due: date
) -> bool:
    found = await db.scalar(
        select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.task_id == task_id,
            Notification.type == NotificationType.due_tomorrow,
            Notification.payload["due_date"].astext == due.isoformat(),
        )
    )
    return found is not None

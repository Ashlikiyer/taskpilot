import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ActivityLog, User


async def add(db: AsyncSession, entries: list[ActivityLog]) -> None:
    db.add_all(entries)
    await db.flush()


async def list_for_task(
    db: AsyncSession, workspace_id: uuid.UUID, task_id: uuid.UUID
) -> list[tuple[ActivityLog, str | None]]:
    """Newest first, with the actor's name (None for system actions or deleted users)."""
    result = await db.execute(
        select(ActivityLog, User.name)
        .outerjoin(User, User.id == ActivityLog.actor_id)
        .where(ActivityLog.workspace_id == workspace_id, ActivityLog.task_id == task_id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id)
    )
    return [(entry, name) for entry, name in result.all()]

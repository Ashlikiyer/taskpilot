import uuid
from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IntakeItem, IntakeStatus


async def add(db: AsyncSession, item: IntakeItem) -> IntakeItem:
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def get_by_id(db: AsyncSession, item_id: uuid.UUID) -> IntakeItem | None:
    return await db.get(IntakeItem, item_id)


async def get_by_external_id(db: AsyncSession, external_id: str) -> IntakeItem | None:
    result = await db.execute(select(IntakeItem).where(IntakeItem.external_id == external_id))
    return result.scalar_one_or_none()


async def list_for_project(
    db: AsyncSession, project_id: uuid.UUID, status: IntakeStatus | None
) -> list[IntakeItem]:
    query = select(IntakeItem).where(IntakeItem.project_id == project_id)
    if status is not None:
        query = query.where(IntakeItem.status == status.value)
    result = await db.execute(query.order_by(IntakeItem.created_at.desc()).limit(200))
    return list(result.scalars())


async def pending_counts(
    db: AsyncSession, project_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, int]:
    ids = list(project_ids)
    if not ids:
        return {}
    result = await db.execute(
        select(IntakeItem.project_id, func.count())
        .where(
            IntakeItem.project_id.in_(ids),
            IntakeItem.status == IntakeStatus.pending.value,
        )
        .group_by(IntakeItem.project_id)
    )
    return {project_id: count for project_id, count in result.all()}

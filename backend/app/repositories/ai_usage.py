import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AIUsage


async def add(db: AsyncSession, usage: AIUsage) -> None:
    db.add(usage)
    await db.flush()


async def count_since(db: AsyncSession, user_id: uuid.UUID, since: datetime) -> int:
    count = await db.scalar(
        select(func.count())
        .select_from(AIUsage)
        .where(AIUsage.user_id == user_id, AIUsage.created_at >= since)
    )
    return count or 0

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, email: str, name: str, password_hash: str) -> User:
    user = User(email=email.lower(), name=name, password_hash=password_hash)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user

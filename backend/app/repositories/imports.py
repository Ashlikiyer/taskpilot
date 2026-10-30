import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ImportJob


async def add(db: AsyncSession, job: ImportJob) -> ImportJob:
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def get_by_id(db: AsyncSession, job_id: uuid.UUID) -> ImportJob | None:
    return await db.get(ImportJob, job_id)

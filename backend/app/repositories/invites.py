import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Invite, MemberRole


async def create(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    email: str,
    role: MemberRole,
    token_hash: str,
    expires_at: datetime,
) -> Invite:
    invite = Invite(
        workspace_id=workspace_id,
        email=email.lower(),
        role=role,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()
    return invite


async def get_by_hash(db: AsyncSession, token_hash: str) -> Invite | None:
    result = await db.execute(select(Invite).where(Invite.token_hash == token_hash))
    return result.scalar_one_or_none()


async def mark_accepted(db: AsyncSession, invite: Invite, now: datetime) -> None:
    invite.accepted_at = now
    await db.flush()

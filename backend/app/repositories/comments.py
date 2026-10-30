import uuid
from collections.abc import Iterable

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Comment, User


async def list_for_task(db: AsyncSession, task_id: uuid.UUID) -> list[tuple[Comment, str | None]]:
    """Oldest first, with the author's name (None if their account was deleted)."""
    result = await db.execute(
        select(Comment, User.name)
        .outerjoin(User, User.id == Comment.author_id)
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at, Comment.id)
    )
    return [(comment, name) for comment, name in result.all()]


async def get_by_id(db: AsyncSession, comment_id: uuid.UUID) -> Comment | None:
    return await db.get(Comment, comment_id)


async def create(
    db: AsyncSession, *, task_id: uuid.UUID, author_id: uuid.UUID, body: str
) -> Comment:
    comment = Comment(task_id=task_id, author_id=author_id, body=body)
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment: Comment) -> None:
    await db.execute(delete(Comment).where(Comment.id == comment.id))


async def counts_by_task(db: AsyncSession, task_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, int]:
    ids = list(task_ids)
    if not ids:
        return {}
    result = await db.execute(
        select(Comment.task_id, func.count())
        .where(Comment.task_id.in_(ids))
        .group_by(Comment.task_id)
    )
    return {task_id: count for task_id, count in result.all()}

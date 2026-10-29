import uuid

from sqlalchemy import delete, select
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

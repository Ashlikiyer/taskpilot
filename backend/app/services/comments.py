import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.db.models import Comment, NotificationType, User
from app.repositories import comments as comments_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.services import mentions
from app.services import notifications as notifications_service
from app.services import tasks as tasks_service
from app.services.tasks import TaskContext


@dataclass(frozen=True)
class CommentContext:
    comment: Comment
    task: TaskContext


def _to_out(comment: Comment, author_name: str | None) -> CommentOut:
    return CommentOut(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=author_name,
        body=comment.body,
        edited_at=comment.edited_at,
        created_at=comment.created_at,
    )


def _require_active_project(ctx: TaskContext) -> None:
    if ctx.project.project.archived_at is not None:
        raise ConflictError("This project is archived. Restore it to add or change comments.")


async def _mentioned_members(db: AsyncSession, ctx: TaskContext, body: str) -> set[uuid.UUID]:
    """Mentioned users who really are workspace members; anything else is ignored."""
    return await workspaces_repo.filter_member_ids(
        db, ctx.project.project.workspace_id, mentions.mentioned_user_ids(body)
    )


async def get_context(db: AsyncSession, comment_id: uuid.UUID, user: User) -> CommentContext:
    comment = await comments_repo.get_by_id(db, comment_id)
    if comment is None:
        raise NotFoundError("Comment not found", code="COMMENT_NOT_FOUND")
    try:
        task = await tasks_service.get_context(db, comment.task_id, user)
    except NotFoundError:
        raise NotFoundError("Comment not found", code="COMMENT_NOT_FOUND") from None
    return CommentContext(comment=comment, task=task)


async def list_comments(db: AsyncSession, ctx: TaskContext) -> list[CommentOut]:
    rows = await comments_repo.list_for_task(db, ctx.task.id)
    return [_to_out(comment, name) for comment, name in rows]


async def create(db: AsyncSession, ctx: TaskContext, data: CommentCreate) -> CommentOut:
    """Any workspace member may comment (viewers included), unless the project is archived."""
    _require_active_project(ctx)
    author = ctx.project.workspace.user
    task = ctx.task
    slug = ctx.project.workspace.workspace.slug
    comment = await comments_repo.create(db, task_id=task.id, author_id=author.id, body=data.body)

    preview = mentions.excerpt(data.body)
    extra = {"comment_id": str(comment.id), "excerpt": preview}
    mentioned = await notifications_service.notify(
        db,
        await _mentioned_members(db, ctx, data.body),
        type=NotificationType.mentioned,
        task=task,
        workspace_slug=slug,
        actor=author,
        **extra,
    )
    # "Comment on my task" for the assignee and creator, unless a mention already told them.
    await notifications_service.notify(
        db,
        {task.assignee_id, task.created_by} - mentioned,
        type=NotificationType.comment,
        task=task,
        workspace_slug=slug,
        actor=author,
        **extra,
    )
    await db.commit()
    return _to_out(comment, author.name)


def _require_author(ctx: CommentContext) -> None:
    if ctx.comment.author_id != ctx.task.project.workspace.user.id:
        raise ForbiddenError("Only the author can change this comment")


async def update(db: AsyncSession, ctx: CommentContext, data: CommentUpdate) -> CommentOut:
    _require_author(ctx)
    _require_active_project(ctx.task)
    comment = ctx.comment
    author = ctx.task.project.workspace.user
    if data.body != comment.body:
        newly_mentioned = await _mentioned_members(db, ctx.task, data.body) - (
            await _mentioned_members(db, ctx.task, comment.body)
        )
        comment.body = data.body
        comment.edited_at = datetime.now(UTC)
        await notifications_service.notify(
            db,
            newly_mentioned,
            type=NotificationType.mentioned,
            task=ctx.task.task,
            workspace_slug=ctx.task.project.workspace.workspace.slug,
            actor=author,
            comment_id=str(comment.id),
            excerpt=mentions.excerpt(data.body),
        )
        await db.commit()
        await db.refresh(comment)
    return _to_out(comment, author.name)


async def delete(db: AsyncSession, ctx: CommentContext) -> None:
    _require_author(ctx)
    _require_active_project(ctx.task)
    await comments_repo.delete_comment(db, ctx.comment)
    await db.commit()

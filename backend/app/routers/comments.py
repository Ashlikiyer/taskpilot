import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CommentAccess, CurrentUser, DbSession, TaskAccess
from app.schemas.comment import (
    CommentCreate,
    CommentOut,
    CommentUpdate,
    NotificationList,
    NotificationOut,
)
from app.services import comments as comments_service
from app.services import notifications as notifications_service

router = APIRouter(tags=["comments"])


@router.get("/tasks/{task_id}/comments")
async def list_comments(db: DbSession, ctx: TaskAccess) -> list[CommentOut]:
    return await comments_service.list_comments(db, ctx)


@router.post("/tasks/{task_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(data: CommentCreate, db: DbSession, ctx: TaskAccess) -> CommentOut:
    return await comments_service.create(db, ctx, data)


@router.patch("/comments/{comment_id}")
async def update_comment(data: CommentUpdate, db: DbSession, ctx: CommentAccess) -> CommentOut:
    return await comments_service.update(db, ctx, data)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(db: DbSession, ctx: CommentAccess) -> None:
    await comments_service.delete(db, ctx)


@router.get("/notifications", tags=["notifications"])
async def list_notifications(
    db: DbSession,
    user: CurrentUser,
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> NotificationList:
    return await notifications_service.list_for_user(db, user, unread_only=unread_only, limit=limit)


@router.post(
    "/notifications/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["notifications"],
)
async def mark_all_notifications_read(db: DbSession, user: CurrentUser) -> None:
    await notifications_service.mark_all_read(db, user)


@router.post("/notifications/{notification_id}/read", tags=["notifications"])
async def mark_notification_read(
    notification_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> NotificationOut:
    return await notifications_service.mark_read(db, user, notification_id)

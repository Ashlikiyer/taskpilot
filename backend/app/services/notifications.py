"""In-app notifications: assigned to me, mentioned, comment on my task, due tomorrow.

Nobody is ever notified about their own action. The payload stores what the bell
needs to display and link (titles, names, workspace slug), so listing
notifications never has to reach into other tables.
"""

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.db.models import Notification, NotificationType, Task, User
from app.repositories import notifications as notifications_repo
from app.schemas.comment import NotificationList, NotificationOut
from app.services.dates import user_today

MAX_LIMIT = 100


def _payload(task: Task, workspace_slug: str, actor: User | None, **extra: Any) -> dict[str, Any]:
    return {
        "task_title": task.title,
        "project_id": str(task.project_id),
        "workspace_slug": workspace_slug,
        "actor_name": actor.name if actor else None,
        **extra,
    }


async def notify(
    db: AsyncSession,
    recipients: Iterable[uuid.UUID | None],
    *,
    type: NotificationType,
    task: Task,
    workspace_slug: str,
    actor: User | None,
    **extra: Any,
) -> set[uuid.UUID]:
    """Notify each recipient once, skipping the person who caused it. Returns who was notified."""
    users = {uid for uid in recipients if uid is not None and (actor is None or uid != actor.id)}
    await notifications_repo.add(
        db,
        [
            Notification(
                user_id=uid,
                type=type.value,
                task_id=task.id,
                payload=_payload(task, workspace_slug, actor, **extra),
            )
            for uid in users
        ],
    )
    return users


def _to_out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        type=notification.type,
        task_id=notification.task_id,
        payload=notification.payload,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


async def list_for_user(
    db: AsyncSession, user: User, *, unread_only: bool, limit: int
) -> NotificationList:
    items = await notifications_repo.list_for_user(
        db, user.id, unread_only=unread_only, limit=min(limit, MAX_LIMIT)
    )
    return NotificationList(
        items=[_to_out(n) for n in items],
        unread_count=await notifications_repo.unread_count(db, user.id),
    )


async def mark_read(db: AsyncSession, user: User, notification_id: uuid.UUID) -> NotificationOut:
    notification = await notifications_repo.get_for_user(db, notification_id, user.id)
    if notification is None:  # someone else's notification looks the same as a missing one
        raise NotFoundError("Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        await db.commit()
    return _to_out(notification)


async def mark_all_read(db: AsyncSession, user: User) -> None:
    await notifications_repo.mark_all_read(db, user.id, datetime.now(UTC))
    await db.commit()


async def create_due_tomorrow(db: AsyncSession, now: datetime | None = None) -> int:
    """Notify assignees of open tasks due tomorrow. Safe to run more than once a day.

    Called by the daily job (Phase 2, F9). "Tomorrow" uses the app timezone
    (Asia/Manila), matching the 8:00 AM PHT schedule.
    """
    tomorrow = user_today(get_settings().app_timezone, now) + timedelta(days=1)
    created = 0
    for task, slug in await notifications_repo.tasks_due_on(db, tomorrow):
        assert task.assignee_id is not None
        if await notifications_repo.due_tomorrow_already_sent(
            db, task.assignee_id, task.id, tomorrow
        ):
            continue
        await notify(
            db,
            [task.assignee_id],
            type=NotificationType.due_tomorrow,
            task=task,
            workspace_slug=slug,
            actor=None,
            due_date=tomorrow.isoformat(),
        )
        created += 1
    await db.commit()
    return created

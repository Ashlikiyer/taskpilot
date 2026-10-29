import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Comment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_task_id_created_at", "task_id", "created_at"),)

    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class NotificationType(StrEnum):
    assigned = "assigned"
    mentioned = "mentioned"
    comment = "comment"
    due_tomorrow = "due_tomorrow"


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id_read_at", "user_id", "read_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(30))
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    # Display data captured when the notification is created (titles, names, link parts).
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

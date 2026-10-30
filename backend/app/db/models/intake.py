import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class IntakeSource(StrEnum):
    email = "email"
    form = "form"


class IntakeStatus(StrEnum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class IntakeItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An email or form submission waiting in a project's Inbox for an admin."""

    __tablename__ = "intake_items"
    __table_args__ = (
        Index("ix_intake_items_project_id_status", "project_id", "status"),
        CheckConstraint("source IN ('email', 'form')", name="source_valid"),
        CheckConstraint("status IN ('pending', 'accepted', 'rejected')", name="status_valid"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(10))
    # Gmail message id; the same email is never processed twice. Null for form posts.
    external_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    raw_subject: Mapped[str] = mapped_column(String(500))
    raw_body: Mapped[str] = mapped_column(Text)
    sender: Mapped[str] = mapped_column(String(320))
    draft: Mapped[dict[str, Any]] = mapped_column(JSONB)
    confidence: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(10), server_default=IntakeStatus.pending.value)
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (CheckConstraint("color ~ '^#[0-9a-f]{6}$'", name="color_hex"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(2000))
    color: Mapped[str] = mapped_column(String(7))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # F10 intake settings. The Gmail label routes forwarded emails to this project;
    # the slug is a random, unguessable path for the public request form.
    intake_email_label: Mapped[str | None] = mapped_column(String(200), unique=True)
    intake_form_enabled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    intake_slug: Mapped[str | None] = mapped_column(String(80), unique=True)


class ProjectMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

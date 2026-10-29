import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Digest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One digest per user, per workspace, per day.

    The spec's schema lists (user_id, date) as unique, but the API is workspace
    scoped (GET /workspaces/{ws_id}/digest/today), so workspace_id is part of the key:
    each workspace's digest only describes that workspace's tasks.
    """

    __tablename__ = "digests"
    __table_args__ = (UniqueConstraint("user_id", "workspace_id", "date"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date)
    # Snapshot of the three task lists when the digest was built.
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

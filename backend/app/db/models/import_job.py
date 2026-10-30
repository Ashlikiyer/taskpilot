import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ImportStatus(StrEnum):
    uploaded = "uploaded"
    mapped = "mapped"
    previewed = "previewed"
    imported = "imported"
    failed = "failed"


class ImportJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One run of the import wizard. The file is parsed on upload and only its cell
    values (as text) are kept here between steps; the file itself is never stored."""

    __tablename__ = "import_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('uploaded', 'mapped', 'previewed', 'imported', 'failed')",
            name="status_valid",
        ),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    file_name: Mapped[str] = mapped_column(String(255))
    sheet_name: Mapped[str | None] = mapped_column(String(100))
    sheet_names: Mapped[list[str]] = mapped_column(JSONB, server_default="[]")
    headers: Mapped[list[str]] = mapped_column(JSONB)
    rows: Mapped[list[list[str | None]]] = mapped_column(JSONB)
    row_numbers: Mapped[list[int]] = mapped_column(JSONB)
    mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10), server_default=ImportStatus.uploaded.value)
    total_rows: Mapped[int] = mapped_column(Integer)
    imported_rows: Mapped[int] = mapped_column(Integer, server_default="0")
    # Rows skipped by the import, with their original values and reasons.
    errors: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Stable constraint names so Alembic autogenerate produces predictable migrations.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


def _utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    # Set in Python rather than relying only on Postgres now(), which returns the
    # *transaction* start time: rows inserted in one transaction (a comment and its
    # notifications, several activity entries) would otherwise share a timestamp
    # and come back in random order. The server default stays for raw SQL inserts.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, server_default=func.now(), onupdate=_utc_now
    )

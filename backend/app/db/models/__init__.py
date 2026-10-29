"""Import every model here so Alembic autogenerate sees the full metadata."""

from app.db.models.base import Base
from app.db.models.user import User

__all__ = ["Base", "User"]

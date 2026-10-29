"""Import every model here so Alembic autogenerate sees the full metadata."""

from app.db.models.auth import RefreshToken
from app.db.models.base import Base
from app.db.models.project import Project, ProjectMember
from app.db.models.task import (
    ActivityLog,
    Label,
    Task,
    TaskLabel,
    TaskPriority,
    TaskSource,
    TaskStatus,
)
from app.db.models.user import User
from app.db.models.workspace import Invite, MemberRole, Workspace, WorkspaceMember

__all__ = [
    "ActivityLog",
    "Base",
    "Invite",
    "Label",
    "MemberRole",
    "Project",
    "ProjectMember",
    "RefreshToken",
    "Task",
    "TaskLabel",
    "TaskPriority",
    "TaskSource",
    "TaskStatus",
    "User",
    "Workspace",
    "WorkspaceMember",
]

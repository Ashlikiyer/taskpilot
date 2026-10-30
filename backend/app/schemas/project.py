import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Color = Annotated[str, StringConstraints(to_lower=True, pattern=r"^#[0-9a-fA-F]{6}$")]
MemberIds = Annotated[list[uuid.UUID], Field(max_length=500)]
IntakeLabel = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]

DEFAULT_COLOR = "#6366f1"


def _blank_to_none(value: str | None) -> str | None:
    return value or None


class ProjectCreate(BaseModel):
    name: ProjectName
    description: Description | None = None
    color: Color = DEFAULT_COLOR
    member_ids: MemberIds = []

    _description = field_validator("description")(_blank_to_none)


class ProjectUpdate(BaseModel):
    """Partial update: only fields sent in the request are changed."""

    name: ProjectName | None = None
    description: Description | None = None
    color: Color | None = None
    member_ids: MemberIds | None = None
    # F10 intake settings (admins). An empty label turns email intake off.
    intake_email_label: IntakeLabel | None = None
    intake_form_enabled: bool | None = None

    _description = field_validator("description")(_blank_to_none)
    _label = field_validator("intake_email_label")(_blank_to_none)


class ProjectOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    color: str
    archived_at: datetime | None
    member_ids: list[uuid.UUID]
    created_at: datetime
    intake_email_label: str | None
    intake_form_enabled: bool
    intake_slug: str | None
    # Pending items in the project's Inbox.
    intake_pending: int

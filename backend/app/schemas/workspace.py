import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.db.models import MemberRole

WorkspaceName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
# The owner role is only ever given to the workspace creator.
AssignableRole = Literal["admin", "member", "viewer"]


class WorkspaceCreate(BaseModel):
    name: WorkspaceName


class WorkspaceUpdate(BaseModel):
    name: WorkspaceName


class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    role: MemberRole
    created_at: datetime


class MemberOut(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    avatar_url: str | None
    role: MemberRole
    joined_at: datetime


class MemberUpdate(BaseModel):
    role: AssignableRole


class InviteCreate(BaseModel):
    email: Annotated[EmailStr, Field(max_length=320)]
    role: AssignableRole = "member"


class InviteOut(BaseModel):
    id: uuid.UUID
    email: str
    role: MemberRole
    expires_at: datetime
    invite_url: str

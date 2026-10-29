import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, StringConstraints

Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000)]


class CommentCreate(BaseModel):
    body: Body


class CommentUpdate(BaseModel):
    body: Body


class CommentOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None
    body: str
    edited_at: datetime | None
    created_at: datetime


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    task_id: uuid.UUID | None
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int

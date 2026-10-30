import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.schemas.ai import QuickAddDraft

Text = Annotated[str, StringConstraints(strip_whitespace=True)]


class EmailIntake(BaseModel):
    """What the Gmail Apps Script posts for each new message under a TaskPilot label."""

    message_id: Annotated[Text, StringConstraints(min_length=1, max_length=200)]
    subject: Annotated[Text, StringConstraints(max_length=500)] = ""
    body: Annotated[str, StringConstraints(max_length=200_000)] = ""
    sender: Annotated[Text, StringConstraints(min_length=1, max_length=320)]
    received_at: datetime
    label: Annotated[Text, StringConstraints(min_length=1, max_length=200)]


class EmailIntakeResult(BaseModel):
    item_id: uuid.UUID
    # True when this Gmail message was already received; the script can mark it read.
    duplicate: bool


class IntakeFormInfo(BaseModel):
    """Public: just enough to label the request form."""

    project_name: str
    workspace_name: str


class IntakeFormSubmission(BaseModel):
    name: Annotated[Text, StringConstraints(min_length=1, max_length=100)]
    email: Annotated[EmailStr, Field(max_length=320)]
    title: Annotated[Text, StringConstraints(min_length=1, max_length=200)]
    details: Annotated[Text, StringConstraints(max_length=5000)] = ""
    # Honeypot: hidden from people, so only bots fill it in.
    website: Annotated[str, StringConstraints(max_length=200)] = ""


class IntakeAIDraft(QuickAddDraft):
    """The spec's F10 output: a QuickAddDraft plus how sure the model is (0–1)."""

    confidence: float = Field(ge=0, le=1)


class IntakeItemOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    source: Literal["email", "form"]
    raw_subject: str
    raw_body: str
    sender: str
    draft: QuickAddDraft
    confidence: float
    status: Literal["pending", "accepted", "rejected"]
    task_id: uuid.UUID | None
    created_at: datetime


class IntakeAccept(BaseModel):
    """Optional edits made in the Inbox before accepting; anything left out keeps the
    AI draft's value."""

    title: Annotated[Text, StringConstraints(min_length=1, max_length=200)] | None = None
    description: Annotated[Text, StringConstraints(max_length=20_000)] | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    label_ids: Annotated[list[uuid.UUID], Field(max_length=20)] | None = None

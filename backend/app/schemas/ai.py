import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

QuickAddText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
]


class QuickAddRequest(BaseModel):
    text: QuickAddText
    # The project the user is looking at; used when the sentence names no project.
    default_project_id: uuid.UUID | None = None


class QuickAddDraft(BaseModel):
    """The spec's F6 model. Used both to validate the AI reply and as the API response."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    assignee_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    labels: list[Annotated[str, Field(max_length=50)]] = Field(default=[], max_length=10)
    warnings: list[Annotated[str, Field(max_length=300)]] = Field(default=[], max_length=10)

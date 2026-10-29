import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints, model_validator


class DigestTask(BaseModel):
    """A snapshot of a task when the digest was built."""

    id: uuid.UUID
    title: str
    project_id: uuid.UUID
    project_name: str
    status: str
    priority: str
    due_date: date | None
    # Only for at-risk tasks: due within 2 days but not started, or stalled in progress.
    reason: Literal["due_soon", "stalled"] | None = None


class DigestContent(BaseModel):
    overdue: list[DigestTask] = []
    due_today: list[DigestTask] = []
    at_risk: list[DigestTask] = []

    def is_empty(self) -> bool:
        return not (self.overdue or self.due_today or self.at_risk)


class DigestOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    date: date
    content: DigestContent
    summary: str | None
    created_at: datetime


class DigestRunResult(BaseModel):
    digests_created: int
    notifications_sent: int
    due_tomorrow_notifications: int


SummaryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]
DIGEST_MAX_WORDS = 60


class DigestSummary(BaseModel):
    """The AI's reply for F9: {"summary": str}, at most 60 words."""

    summary: SummaryText

    @model_validator(mode="after")
    def _within_word_limit(self) -> DigestSummary:
        words = len(self.summary.split())
        if words > DIGEST_MAX_WORDS:
            raise ValueError(f"The summary has {words} words; use at most {DIGEST_MAX_WORDS}.")
        return self

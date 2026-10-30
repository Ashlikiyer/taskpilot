import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

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


SubtaskTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]


class SubtaskSuggestions(BaseModel):
    """The spec's F7 model: 3 to 8 subtask titles, each at most 120 characters."""

    subtasks: list[SubtaskTitle] = Field(min_length=3, max_length=8)


SUMMARY_MAX_WORDS = 80
SummaryPoint = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
]


class ThreadSummary(BaseModel):
    """The spec's F8 model. The whole summary must be under 80 words."""

    decisions: list[SummaryPoint] = Field(max_length=5)
    open_questions: list[SummaryPoint] = Field(max_length=5)
    next_steps: list[SummaryPoint] = Field(max_length=5)

    @model_validator(mode="after")
    def _under_word_limit(self) -> ThreadSummary:
        points = [*self.decisions, *self.open_questions, *self.next_steps]
        words = sum(len(point.split()) for point in points)
        if words >= SUMMARY_MAX_WORDS:
            raise ValueError(
                f"The summary has {words} words; it must be under {SUMMARY_MAX_WORDS}."
            )
        return self


class ThreadSummaryOut(ThreadSummary):
    generated_at: datetime
    # True when the saved summary was returned without calling the AI.
    cached: bool


class AIUsageOut(BaseModel):
    """The current user's AI calls today; resets at midnight in the app timezone."""

    used: int
    limit: int

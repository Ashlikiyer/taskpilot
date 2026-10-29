import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.db.models import TaskPriority, TaskStatus
from app.schemas.project import ProjectOut

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20_000)]
LabelName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Color = Annotated[str, StringConstraints(to_lower=True, pattern=r"^#[0-9a-fA-F]{6}$")]
LabelIds = Annotated[list[uuid.UUID], Field(max_length=20)]


def _blank_to_none(value: str | None) -> str | None:
    return value or None


class LabelCreate(BaseModel):
    name: LabelName
    color: Color = "#64748b"


class LabelOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str


class TaskCreate(BaseModel):
    title: Title
    description: Description | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    label_ids: LabelIds = []
    parent_id: uuid.UUID | None = None
    # Set by the quick-add preview when the user confirms an AI draft.
    source: Literal["manual", "ai_quick_add"] = "manual"

    _description = field_validator("description")(_blank_to_none)


class TaskUpdate(BaseModel):
    """Partial update: only fields sent in the request are changed."""

    title: Title | None = None
    description: Description | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    label_ids: LabelIds | None = None

    _description = field_validator("description")(_blank_to_none)


class TaskMove(BaseModel):
    """Drop a card into `status`, between `before_id` (the card above) and
    `after_id` (the card below). Omit either one at the top or bottom of the column."""

    status: TaskStatus
    before_id: uuid.UUID | None = None
    after_id: uuid.UUID | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    assignee_id: uuid.UUID | None
    due_date: date | None
    position: float
    created_by: uuid.UUID | None
    completed_at: datetime | None
    source: str
    labels: list[LabelOut]
    subtask_count: int
    subtasks_done: int
    created_at: datetime
    updated_at: datetime


class TaskPage(BaseModel):
    items: list[TaskOut]
    total: int
    page: int
    page_size: int


class ActivityOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None
    actor_id: uuid.UUID | None
    actor_name: str | None
    action: str
    field: str | None
    old_value: str | None
    new_value: str | None
    created_at: datetime


class SearchResults(BaseModel):
    tasks: list[TaskOut]
    projects: list[ProjectOut]


class MyTasks(BaseModel):
    """Open tasks assigned to the current user, grouped by due date in their timezone."""

    today: date
    overdue: list[TaskOut]
    due_today: list[TaskOut]
    this_week: list[TaskOut]
    later: list[TaskOut]
    no_date: list[TaskOut]

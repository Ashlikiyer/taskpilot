import re
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

ImportTarget = Literal[
    "title", "description", "status", "priority", "assignee", "due_date", "labels", "ignore"
]
StatusValue = Literal["todo", "in_progress", "in_review", "done"]
PriorityValue = Literal["low", "medium", "high", "urgent"]
RawValue = Annotated[str, StringConstraints(max_length=200)]

# Only strptime directives and separators: a date format is parsed, never evaluated,
# but keeping it to this shape catches nonsense early.
_DATE_FORMAT = re.compile(r"^(%[dmyYbBaAjHMS]|[ /.,\-:T])+$")


class ImportMapping(BaseModel):
    """The spec's F11 model: which column is which field, how to translate status and
    priority values, and the date format. Suggested by the AI, editable by the user."""

    columns: dict[Annotated[str, StringConstraints(max_length=100)], ImportTarget] = Field(
        max_length=50
    )
    status_values: dict[RawValue, StatusValue] = Field(default={}, max_length=200)
    priority_values: dict[RawValue, PriorityValue] = Field(default={}, max_length=200)
    date_format: Annotated[str, StringConstraints(max_length=30)] | None = None

    @field_validator("date_format")
    @classmethod
    def _valid_date_format(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if not _DATE_FORMAT.match(value) or "%" not in value:
            raise ValueError(f"{value!r} is not a date format like %d/%m/%Y")
        return value


class ImportJobOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    project_id: uuid.UUID | None
    file_name: str
    sheet_name: str | None
    # Every sheet in an Excel file, so the user can pick another one.
    sheet_names: list[str]
    headers: list[str]
    sample_rows: list[list[str | None]]
    # Distinct values per column (up to 50), for mapping status/priority values.
    column_values: dict[str, list[str]]
    total_rows: int
    status: Literal["uploaded", "mapped", "previewed", "imported", "failed"]
    mapping: ImportMapping | None
    imported_rows: int
    created_at: datetime


class ImportOptions(BaseModel):
    project_id: uuid.UUID
    # Spec: duplicates (same title and due date already in the project) are imported
    # unless the user unticks "allow duplicates".
    allow_duplicates: bool = True


class RowIssue(BaseModel):
    level: Literal["error", "warning", "info"]
    field: str
    message: str


class PreviewRow(BaseModel):
    row_number: int  # as shown in the spreadsheet (header is row 1)
    title: str | None
    description: str | None
    status: StatusValue
    priority: PriorityValue
    assignee_name: str | None
    due_date: date | None
    labels: list[str]
    issues: list[RowIssue]


class PreviewResult(BaseModel):
    total_rows: int
    valid_rows: int
    rows_with_warnings: int
    rows_with_errors: int
    new_labels: list[str]
    # The first 50 rows, issues included, for the preview table.
    rows: list[PreviewRow]


class SkippedRow(BaseModel):
    row_number: int
    values: dict[str, str | None]  # original cells, by header
    reasons: list[str]


class ImportResult(BaseModel):
    imported_rows: int
    skipped_rows: list[SkippedRow]
    labels_created: list[str]

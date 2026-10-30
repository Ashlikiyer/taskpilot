import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel


class StatusCount(BaseModel):
    status: Literal["todo", "in_progress", "in_review"]
    count: int


class WeekCount(BaseModel):
    week_start: date  # a Monday, in the app timezone
    count: int


class MemberLoad(BaseModel):
    user_id: uuid.UUID
    name: str
    open: int


class DashboardOut(BaseModel):
    """Workspace (or one project's) numbers for the dashboard. Top-level tasks in
    active projects only; subtasks are counted through their parent."""

    today: date
    project_id: uuid.UUID | None
    open_total: int
    open_projects: int
    open_by_status: list[StatusCount]
    overdue: int
    overdue_week_ago: int
    completed_this_week: int
    completed_per_week: list[WeekCount]  # oldest first
    workload: list[MemberLoad]  # most open tasks first
    created_recently: int  # in the same weeks as completed_per_week
    created_by_ai: int  # of those, from quick-add, intake or import

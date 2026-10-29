"""F9 task lists. Facts come from the database; the AI only writes the summary."""

from collections.abc import Sequence
from datetime import date, datetime, timedelta

from app.db.models import Task, TaskStatus
from app.schemas.digest import DigestContent, DigestTask

DUE_SOON_DAYS = 2
STALLED_AFTER = timedelta(days=5)


def _snapshot(task: Task, project_name: str, reason: str | None = None) -> DigestTask:
    return DigestTask.model_validate(
        {
            "id": task.id,
            "title": task.title,
            "project_id": task.project_id,
            "project_name": project_name,
            "status": task.status.value,
            "priority": task.priority.value,
            "due_date": task.due_date,
            "reason": reason,
        }
    )


def build_lists(
    rows: Sequence[tuple[Task, str, datetime]], today: date, now: datetime
) -> DigestContent:
    """Sort a user's open tasks into the spec's three lists.

    - Overdue: due before today.
    - Due today: due today.
    - At risk: due within 2 days and still todo, or in progress with no activity
      for 5 days. A task appears in one list only.
    """
    content = DigestContent()
    for task, project_name, last_activity in rows:
        if task.status == TaskStatus.done:
            continue
        due = task.due_date
        if due is not None and due < today:
            content.overdue.append(_snapshot(task, project_name))
        elif due == today:
            content.due_today.append(_snapshot(task, project_name))
        elif (
            due is not None
            and due <= today + timedelta(days=DUE_SOON_DAYS)
            and task.status == TaskStatus.todo
        ):
            content.at_risk.append(_snapshot(task, project_name, "due_soon"))
        elif task.status == TaskStatus.in_progress and now - last_activity >= STALLED_AFTER:
            content.at_risk.append(_snapshot(task, project_name, "stalled"))
    return content

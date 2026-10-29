import uuid
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import ColumnElement, case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Task, TaskLabel, TaskPriority, TaskStatus

SORTABLE = {
    "position": Task.position,
    "created_at": Task.created_at,
    "due_date": Task.due_date,
    "priority": Task.priority,
    "status": Task.status,
    "title": Task.title,
}


@dataclass(frozen=True)
class TaskFilters:
    statuses: list[TaskStatus] = field(default_factory=list)
    priorities: list[TaskPriority] = field(default_factory=list)
    assignee_id: uuid.UUID | None = None
    label_id: uuid.UUID | None = None
    due_from: date | None = None
    due_to: date | None = None
    # None lists top-level tasks; a task id lists that task's subtasks.
    parent_id: uuid.UUID | None = None


async def create(db: AsyncSession, task: Task) -> Task:
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return task


async def get_by_id(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
    return await db.get(Task, task_id)


async def list_page(
    db: AsyncSession,
    project_id: uuid.UUID,
    filters: TaskFilters,
    *,
    sort: str,
    page: int,
    page_size: int,
) -> tuple[list[Task], int]:
    conditions: list[ColumnElement[bool]] = [
        Task.project_id == project_id,
        Task.parent_id.is_(None)
        if filters.parent_id is None
        else Task.parent_id == filters.parent_id,
    ]
    if filters.statuses:
        conditions.append(Task.status.in_(filters.statuses))
    if filters.priorities:
        conditions.append(Task.priority.in_(filters.priorities))
    if filters.assignee_id:
        conditions.append(Task.assignee_id == filters.assignee_id)
    if filters.label_id:
        conditions.append(
            Task.id.in_(select(TaskLabel.task_id).where(TaskLabel.label_id == filters.label_id))
        )
    if filters.due_from:
        conditions.append(Task.due_date >= filters.due_from)
    if filters.due_to:
        conditions.append(Task.due_date <= filters.due_to)

    descending = sort.startswith("-")
    column = SORTABLE[sort.lstrip("-")]
    order = column.desc().nulls_last() if descending else column.asc().nulls_last()

    total = await db.scalar(select(func.count()).select_from(Task).where(*conditions))
    result = await db.execute(
        select(Task)
        .where(*conditions)
        .order_by(order, Task.position, Task.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars()), total or 0


def _scope(
    project_id: uuid.UUID, parent_id: uuid.UUID | None, status: TaskStatus
) -> list[ColumnElement[bool]]:
    """Top-level tasks are ordered per board column; subtasks per parent."""
    if parent_id is not None:
        return [Task.parent_id == parent_id]
    return [Task.project_id == project_id, Task.parent_id.is_(None), Task.status == status]


async def max_position(
    db: AsyncSession, project_id: uuid.UUID, parent_id: uuid.UUID | None, status: TaskStatus
) -> float | None:
    return await db.scalar(
        select(func.max(Task.position)).where(*_scope(project_id, parent_id, status))
    )


async def column_tasks(
    db: AsyncSession, project_id: uuid.UUID, status: TaskStatus, *, exclude: uuid.UUID
) -> list[Task]:
    result = await db.execute(
        select(Task)
        .where(*_scope(project_id, None, status), Task.id != exclude)
        .order_by(Task.position, Task.id)
    )
    return list(result.scalars())


async def subtask_counts(
    db: AsyncSession, task_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, int]]:
    """Map parent id -> (number of subtasks, number done)."""
    ids = list(task_ids)
    if not ids:
        return {}
    result = await db.execute(
        select(
            Task.parent_id,
            func.count(),
            func.count(case((Task.status == TaskStatus.done, 1))),
        )
        .where(Task.parent_id.in_(ids))
        .group_by(Task.parent_id)
    )
    return {parent_id: (total, done) for parent_id, total, done in result.all() if parent_id}


async def delete_task(db: AsyncSession, task: Task) -> None:
    await db.execute(delete(Task).where(Task.id == task.id))

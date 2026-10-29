import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ConflictError, ForbiddenError, NotFoundError
from app.db.models import (
    ActivityLog,
    Label,
    MemberRole,
    Task,
    TaskSource,
    TaskStatus,
    User,
)
from app.repositories import activity as activity_repo
from app.repositories import labels as labels_repo
from app.repositories import projects as projects_repo
from app.repositories import tasks as tasks_repo
from app.repositories import workspaces as workspaces_repo
from app.repositories.tasks import TaskFilters
from app.schemas.task import (
    ActivityOut,
    LabelOut,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskPage,
    TaskUpdate,
)
from app.services import positions
from app.services import projects as projects_service
from app.services.projects import ProjectContext
from app.services.workspaces import ROLE_RANK

# Fields a PATCH may change, in the order activity entries are written.
_SCALAR_FIELDS = ("title", "description", "status", "priority", "assignee_id", "due_date")


@dataclass(frozen=True)
class TaskContext:
    task: Task
    project: ProjectContext


def _validation_error(message: str) -> AppError:
    return AppError(400, "VALIDATION_ERROR", message)


def _task_not_found() -> NotFoundError:
    return NotFoundError("Task not found", code="TASK_NOT_FOUND")


def _as_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, Enum):
        return str(value.value)
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


async def _is_project_member(db: AsyncSession, ctx: ProjectContext) -> bool:
    members = await projects_repo.member_ids_by_project(db, [ctx.project.id])
    return ctx.workspace.user.id in members[ctx.project.id]


async def _require_can_edit(db: AsyncSession, ctx: ProjectContext) -> None:
    """Admins edit tasks anywhere; members only in projects they belong to."""
    role = ctx.workspace.role
    if role == MemberRole.viewer or (
        role == MemberRole.member and not await _is_project_member(db, ctx)
    ):
        raise ForbiddenError("Only members of this project can change its tasks")
    if ctx.project.archived_at is not None:
        raise ConflictError("This project is archived. Restore it to change its tasks.")


async def _validate_assignee(
    db: AsyncSession, ctx: ProjectContext, assignee_id: uuid.UUID | None
) -> None:
    if assignee_id is None:
        return
    member = await workspaces_repo.get_member(db, ctx.project.workspace_id, assignee_id)
    can_work = member is not None and (
        ROLE_RANK[member.role] >= ROLE_RANK[MemberRole.admin]
        or (
            member.role == MemberRole.member
            and assignee_id
            in (await projects_repo.member_ids_by_project(db, [ctx.project.id]))[ctx.project.id]
        )
    )
    if not can_work:
        raise _validation_error("The assignee must be able to work on this project")


async def _validated_labels(
    db: AsyncSession, ctx: ProjectContext, label_ids: list[uuid.UUID]
) -> list[Label]:
    wanted = set(label_ids)
    labels = await labels_repo.get_many(db, ctx.project.workspace_id, wanted)
    if len(labels) != len(wanted):
        raise _validation_error("Labels must belong to this workspace")
    return labels


def _entry(
    ctx: ProjectContext, task_id: uuid.UUID, action: str, **values: str | None
) -> ActivityLog:
    return ActivityLog(
        workspace_id=ctx.project.workspace_id,
        task_id=task_id,
        actor_id=ctx.workspace.user.id,
        action=action,
        **values,
    )


def _label_names(labels: list[Label]) -> str | None:
    return ", ".join(sorted(label.name for label in labels)) or None


async def to_outs(db: AsyncSession, tasks: list[Task]) -> list[TaskOut]:
    ids = [task.id for task in tasks]
    labels = await labels_repo.labels_by_task(db, ids)
    counts = await tasks_repo.subtask_counts(db, ids)
    return [
        TaskOut(
            id=task.id,
            project_id=task.project_id,
            parent_id=task.parent_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assignee_id=task.assignee_id,
            due_date=task.due_date,
            position=task.position,
            created_by=task.created_by,
            completed_at=task.completed_at,
            source=task.source,
            labels=[LabelOut(id=lb.id, name=lb.name, color=lb.color) for lb in labels[task.id]],
            subtask_count=counts.get(task.id, (0, 0))[0],
            subtasks_done=counts.get(task.id, (0, 0))[1],
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
        for task in tasks
    ]


async def _to_out(db: AsyncSession, task: Task) -> TaskOut:
    await db.refresh(task)
    return (await to_outs(db, [task]))[0]


def _apply_status(task: Task, status: TaskStatus) -> None:
    task.status = status
    if status == TaskStatus.done and task.completed_at is None:
        task.completed_at = datetime.now(UTC)
    elif status != TaskStatus.done:
        task.completed_at = None


async def _end_of_column(db: AsyncSession, task: Task) -> float:
    last = await tasks_repo.max_position(db, task.project_id, task.parent_id, task.status)
    return positions.between(last, None) or positions.GAP


async def get_context(db: AsyncSession, task_id: uuid.UUID, user: User) -> TaskContext:
    """Resolve a task through its project and workspace; outsiders get 404."""
    task = await tasks_repo.get_by_id(db, task_id)
    if task is None:
        raise _task_not_found()
    try:
        project = await projects_service.get_context(db, task.project_id, user)
    except NotFoundError:
        raise _task_not_found() from None
    return TaskContext(task=task, project=project)


async def list_tasks(
    db: AsyncSession,
    ctx: ProjectContext,
    filters: TaskFilters,
    *,
    sort: str,
    page: int,
    page_size: int,
) -> TaskPage:
    if sort.lstrip("-") not in tasks_repo.SORTABLE:
        raise _validation_error(f"Can't sort by '{sort}'")
    tasks, total = await tasks_repo.list_page(
        db, ctx.project.id, filters, sort=sort, page=page, page_size=page_size
    )
    return TaskPage(items=await to_outs(db, tasks), total=total, page=page, page_size=page_size)


async def create(
    db: AsyncSession,
    ctx: ProjectContext,
    data: TaskCreate,
    *,
    source: TaskSource = TaskSource.manual,
) -> TaskOut:
    await _require_can_edit(db, ctx)
    if data.parent_id is not None:
        parent = await tasks_repo.get_by_id(db, data.parent_id)
        if parent is None or parent.project_id != ctx.project.id:
            raise _validation_error("The parent task must be in the same project")
        if parent.parent_id is not None:
            raise _validation_error("Subtasks can't have their own subtasks")
    await _validate_assignee(db, ctx, data.assignee_id)
    labels = await _validated_labels(db, ctx, data.label_ids)

    task = Task(
        project_id=ctx.project.id,
        parent_id=data.parent_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        created_by=ctx.workspace.user.id,
        source=source.value,
    )
    _apply_status(task, data.status)
    task.position = await _end_of_column(db, task)
    await tasks_repo.create(db, task)
    if labels:
        await labels_repo.set_task_labels(db, task.id, {label.id for label in labels})
    await activity_repo.add(db, [_entry(ctx, task.id, "created", new_value=task.title)])
    await db.commit()
    return await _to_out(db, task)


async def get(db: AsyncSession, ctx: TaskContext) -> TaskOut:
    return await _to_out(db, ctx.task)


async def update(db: AsyncSession, ctx: TaskContext, data: TaskUpdate) -> TaskOut:
    await _require_can_edit(db, ctx.project)
    task = ctx.task
    sent = data.model_fields_set
    entries: list[ActivityLog] = []

    for name in _SCALAR_FIELDS:
        if name not in sent:
            continue
        new = getattr(data, name)
        if name in ("title", "status", "priority") and new is None:
            raise _validation_error(f"{name} can't be empty")
        old = getattr(task, name)
        if new == old:
            continue
        if name == "assignee_id":
            await _validate_assignee(db, ctx.project, new)
        if name == "status":
            _apply_status(task, new)
            if task.parent_id is None:
                task.position = await _end_of_column(db, task)
        else:
            setattr(task, name, new)
        entries.append(
            _entry(
                ctx.project,
                task.id,
                "updated",
                field=name,
                old_value=_as_text(old),
                new_value=_as_text(new),
            )
        )

    if "label_ids" in sent and data.label_ids is not None:
        labels = await _validated_labels(db, ctx.project, data.label_ids)
        current = (await labels_repo.labels_by_task(db, [task.id]))[task.id]
        if {lb.id for lb in labels} != {lb.id for lb in current}:
            await labels_repo.set_task_labels(db, task.id, {lb.id for lb in labels})
            entries.append(
                _entry(
                    ctx.project,
                    task.id,
                    "updated",
                    field="labels",
                    old_value=_label_names(current),
                    new_value=_label_names(labels),
                )
            )

    if entries:
        await activity_repo.add(db, entries)
        await db.commit()
    return await _to_out(db, task)


async def _neighbour(
    db: AsyncSession, task: Task, neighbour_id: uuid.UUID | None, status: TaskStatus
) -> Task | None:
    if neighbour_id is None:
        return None
    neighbour = await tasks_repo.get_by_id(db, neighbour_id)
    if (
        neighbour is None
        or neighbour.id == task.id
        or neighbour.project_id != task.project_id
        or neighbour.parent_id is not None
        or neighbour.status != status
    ):
        raise _validation_error("before_id and after_id must be cards in the target column")
    return neighbour


async def move(db: AsyncSession, ctx: TaskContext, data: TaskMove) -> TaskOut:
    """Place a top-level task in a column between two neighbouring cards."""
    await _require_can_edit(db, ctx.project)
    task = ctx.task
    if task.parent_id is not None:
        raise _validation_error("Subtasks can't be moved on the board")
    before = await _neighbour(db, task, data.before_id, data.status)
    after = await _neighbour(db, task, data.after_id, data.status)

    position = positions.between(
        before.position if before else None, after.position if after else None
    )
    if position is None:
        # The gap is too small to split: renumber the column, then try again.
        column = await tasks_repo.column_tasks(db, task.project_id, data.status, exclude=task.id)
        for card, new_position in zip(column, positions.evenly_spaced(len(column)), strict=True):
            card.position = new_position
        position = positions.between(
            before.position if before else None, after.position if after else None
        )
        assert position is not None

    old_status = task.status
    task.position = position
    if data.status != old_status:
        _apply_status(task, data.status)
        entry = _entry(
            ctx.project,
            task.id,
            "updated",
            field="status",
            old_value=old_status.value,
            new_value=data.status.value,
        )
    else:
        entry = _entry(ctx.project, task.id, "reordered")
    await activity_repo.add(db, [entry])
    await db.commit()
    return await _to_out(db, task)


async def delete(db: AsyncSession, ctx: TaskContext) -> None:
    """Admins delete any task; members only tasks they created. History is kept."""
    role = ctx.project.workspace.role
    is_creator = ctx.task.created_by == ctx.project.workspace.user.id
    if ROLE_RANK[role] < ROLE_RANK[MemberRole.admin] and not (
        role == MemberRole.member and is_creator
    ):
        raise ForbiddenError("You can only delete tasks you created")
    await _require_can_edit(db, ctx.project)
    await activity_repo.add(
        db, [_entry(ctx.project, ctx.task.id, "deleted", old_value=ctx.task.title)]
    )
    await tasks_repo.delete_task(db, ctx.task)
    await db.commit()


async def activity(db: AsyncSession, ctx: TaskContext) -> list[ActivityOut]:
    rows = await activity_repo.list_for_task(db, ctx.project.project.workspace_id, ctx.task.id)
    return [
        ActivityOut(
            id=entry.id,
            task_id=entry.task_id,
            actor_id=entry.actor_id,
            actor_name=name,
            action=entry.action,
            field=entry.field,
            old_value=entry.old_value,
            new_value=entry.new_value,
            created_at=entry.created_at,
        )
        for entry, name in rows
    ]

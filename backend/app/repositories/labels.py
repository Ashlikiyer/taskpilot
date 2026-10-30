import uuid
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Label, TaskLabel


async def list_for_workspace(db: AsyncSession, workspace_id: uuid.UUID) -> list[Label]:
    result = await db.execute(
        select(Label).where(Label.workspace_id == workspace_id).order_by(func.lower(Label.name))
    )
    return list(result.scalars())


async def get_by_name(db: AsyncSession, workspace_id: uuid.UUID, name: str) -> Label | None:
    result = await db.execute(
        select(Label).where(
            Label.workspace_id == workspace_id, func.lower(Label.name) == name.lower()
        )
    )
    return result.scalar_one_or_none()


async def create(db: AsyncSession, *, workspace_id: uuid.UUID, name: str, color: str) -> Label:
    label = Label(workspace_id=workspace_id, name=name, color=color)
    db.add(label)
    await db.flush()
    return label


async def get_many(
    db: AsyncSession, workspace_id: uuid.UUID, label_ids: Iterable[uuid.UUID]
) -> list[Label]:
    ids = list(label_ids)
    if not ids:
        return []
    result = await db.execute(
        select(Label).where(Label.workspace_id == workspace_id, Label.id.in_(ids))
    )
    return list(result.scalars())


async def labels_by_task(
    db: AsyncSession, task_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[Label]]:
    ids = list(task_ids)
    labels: dict[uuid.UUID, list[Label]] = defaultdict(list)
    if not ids:
        return labels
    result = await db.execute(
        select(TaskLabel.task_id, Label)
        .join(Label, Label.id == TaskLabel.label_id)
        .where(TaskLabel.task_id.in_(ids))
        .order_by(func.lower(Label.name))
    )
    for task_id, label in result.all():
        labels[task_id].append(label)
    return labels


async def set_task_labels(db: AsyncSession, task_id: uuid.UUID, label_ids: set[uuid.UUID]) -> None:
    """Replace the task's labels with exactly `label_ids`."""
    current = {label.id for label in (await labels_by_task(db, [task_id]))[task_id]}
    if removed := current - label_ids:
        await db.execute(
            delete(TaskLabel).where(TaskLabel.task_id == task_id, TaskLabel.label_id.in_(removed))
        )
    db.add_all(TaskLabel(task_id=task_id, label_id=lid) for lid in label_ids - current)
    await db.flush()


async def add_task_labels(db: AsyncSession, pairs: list[tuple[uuid.UUID, uuid.UUID]]) -> None:
    db.add_all(TaskLabel(task_id=task_id, label_id=label_id) for task_id, label_id in pairs)
    await db.flush()

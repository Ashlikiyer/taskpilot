import uuid
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Project, ProjectMember


async def create(
    db: AsyncSession,
    *,
    workspace_id: uuid.UUID,
    name: str,
    description: str | None,
    color: str,
) -> Project:
    project = Project(workspace_id=workspace_id, name=name, description=description, color=color)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


async def get_by_id(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    return await db.get(Project, project_id)


async def list_for_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, *, include_archived: bool
) -> list[Project]:
    query = select(Project).where(Project.workspace_id == workspace_id)
    if not include_archived:
        query = query.where(Project.archived_at.is_(None))
    result = await db.execute(query.order_by(Project.name))
    return list(result.scalars())


async def member_ids_by_project(
    db: AsyncSession, project_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    ids = list(project_ids)
    members: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    if not ids:
        return members
    result = await db.execute(
        select(ProjectMember.project_id, ProjectMember.user_id)
        .where(ProjectMember.project_id.in_(ids))
        .order_by(ProjectMember.created_at)
    )
    for project_id, user_id in result.all():
        members[project_id].append(user_id)
    return members


async def set_members(db: AsyncSession, project_id: uuid.UUID, user_ids: set[uuid.UUID]) -> None:
    """Replace the project's member list with exactly `user_ids`."""
    current = set((await member_ids_by_project(db, [project_id]))[project_id])
    if removed := current - user_ids:
        await db.execute(
            delete(ProjectMember).where(
                ProjectMember.project_id == project_id, ProjectMember.user_id.in_(removed)
            )
        )
    db.add_all(ProjectMember(project_id=project_id, user_id=uid) for uid in user_ids - current)
    await db.flush()


async def remove_user_from_workspace_projects(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    workspace_projects = select(Project.id).where(Project.workspace_id == workspace_id)
    await db.execute(
        delete(ProjectMember).where(
            ProjectMember.user_id == user_id, ProjectMember.project_id.in_(workspace_projects)
        )
    )


async def search_by_name(
    db: AsyncSession, workspace_id: uuid.UUID, text: str, *, limit: int
) -> list[Project]:
    """Projects whose name contains the text, archived ones included."""
    escaped = text.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    result = await db.execute(
        select(Project)
        .where(
            Project.workspace_id == workspace_id,
            Project.name.ilike(f"%{escaped}%", escape="\\"),
        )
        .order_by(Project.archived_at.is_not(None), Project.name)
        .limit(limit)
    )
    return list(result.scalars())


async def get_by_intake_label(db: AsyncSession, label: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.intake_email_label == label))
    return result.scalar_one_or_none()


async def get_by_intake_slug(db: AsyncSession, slug: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.intake_slug == slug))
    return result.scalar_one_or_none()

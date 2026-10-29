import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.db.models import MemberRole, Project, User
from app.repositories import projects as projects_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import workspaces as workspaces_service
from app.services.workspaces import WorkspaceContext


@dataclass(frozen=True)
class ProjectContext:
    """A project plus the current user's access to its workspace."""

    project: Project
    workspace: WorkspaceContext


def _project_not_found() -> NotFoundError:
    return NotFoundError("Project not found", code="PROJECT_NOT_FOUND")


def _to_out(project: Project, member_ids: list[uuid.UUID]) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        description=project.description,
        color=project.color,
        archived_at=project.archived_at,
        member_ids=member_ids,
        created_at=project.created_at,
    )


async def to_outs(db: AsyncSession, projects: list[Project]) -> list[ProjectOut]:
    members = await projects_repo.member_ids_by_project(db, (p.id for p in projects))
    return [_to_out(project, members[project.id]) for project in projects]


async def _out(db: AsyncSession, project: Project) -> ProjectOut:
    members = await projects_repo.member_ids_by_project(db, [project.id])
    return _to_out(project, members[project.id])


async def _validated_member_ids(
    db: AsyncSession, workspace_id: uuid.UUID, member_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    wanted = set(member_ids)
    unknown = wanted - await workspaces_repo.filter_member_ids(db, workspace_id, wanted)
    if unknown:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Project members must belong to the workspace",
            {"unknown_member_ids": sorted(str(uid) for uid in unknown)},
        )
    return wanted


async def get_context(db: AsyncSession, project_id: uuid.UUID, user: User) -> ProjectContext:
    """Resolve a project through its workspace; non-members get 404, never 403."""
    project = await projects_repo.get_by_id(db, project_id)
    if project is None:
        raise _project_not_found()
    try:
        workspace = await workspaces_service.get_context(db, project.workspace_id, user)
    except NotFoundError:
        raise _project_not_found() from None
    return ProjectContext(project=project, workspace=workspace)


async def list_projects(
    db: AsyncSession, ctx: WorkspaceContext, *, include_archived: bool
) -> list[ProjectOut]:
    projects = await projects_repo.list_for_workspace(
        db, ctx.workspace.id, include_archived=include_archived
    )
    return await to_outs(db, projects)


async def create(db: AsyncSession, ctx: WorkspaceContext, data: ProjectCreate) -> ProjectOut:
    ctx.require(MemberRole.admin)
    member_ids = await _validated_member_ids(db, ctx.workspace.id, data.member_ids)
    project = await projects_repo.create(
        db,
        workspace_id=ctx.workspace.id,
        name=data.name,
        description=data.description,
        color=data.color,
    )
    await projects_repo.set_members(db, project.id, member_ids | {ctx.user.id})
    await db.commit()
    return await _out(db, project)


async def get(db: AsyncSession, ctx: ProjectContext) -> ProjectOut:
    return await _out(db, ctx.project)


async def update(db: AsyncSession, ctx: ProjectContext, data: ProjectUpdate) -> ProjectOut:
    ctx.workspace.require(MemberRole.admin)
    project = ctx.project
    fields = data.model_fields_set
    if "name" in fields and data.name is not None:
        project.name = data.name
    if "description" in fields:
        project.description = data.description
    if "color" in fields and data.color is not None:
        project.color = data.color
    if "member_ids" in fields and data.member_ids is not None:
        member_ids = await _validated_member_ids(db, project.workspace_id, data.member_ids)
        await projects_repo.set_members(db, project.id, member_ids)
    await db.commit()
    await db.refresh(project)
    return await _out(db, project)


async def set_archived(db: AsyncSession, ctx: ProjectContext, *, archived: bool) -> ProjectOut:
    ctx.workspace.require(MemberRole.admin)
    project = ctx.project
    if archived and project.archived_at is None:
        project.archived_at = datetime.now(UTC)
    elif not archived:
        project.archived_at = None
    await db.commit()
    await db.refresh(project)
    return await _out(db, project)

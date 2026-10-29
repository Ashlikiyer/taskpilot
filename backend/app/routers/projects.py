from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import AnyMember, DbSession, ProjectAccess, require_role
from app.db.models import MemberRole
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import projects as projects_service
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["projects"])

Admin = Annotated[WorkspaceContext, Depends(require_role(MemberRole.admin))]


@router.get("/workspaces/{ws_id}/projects")
async def list_projects(
    db: DbSession, ctx: AnyMember, include_archived: Annotated[bool, Query()] = False
) -> list[ProjectOut]:
    return await projects_service.list_projects(db, ctx, include_archived=include_archived)


@router.post("/workspaces/{ws_id}/projects", status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, db: DbSession, ctx: Admin) -> ProjectOut:
    return await projects_service.create(db, ctx, data)


@router.get("/projects/{project_id}")
async def get_project(db: DbSession, ctx: ProjectAccess) -> ProjectOut:
    return await projects_service.get(db, ctx)


@router.patch("/projects/{project_id}")
async def update_project(data: ProjectUpdate, db: DbSession, ctx: ProjectAccess) -> ProjectOut:
    return await projects_service.update(db, ctx, data)


@router.post("/projects/{project_id}/archive")
async def archive_project(db: DbSession, ctx: ProjectAccess) -> ProjectOut:
    return await projects_service.set_archived(db, ctx, archived=True)


@router.post("/projects/{project_id}/restore")
async def restore_project(db: DbSession, ctx: ProjectAccess) -> ProjectOut:
    return await projects_service.set_archived(db, ctx, archived=False)

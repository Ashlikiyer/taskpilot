import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.deps import AnyMember, CurrentUser, DbSession, require_role
from app.db.models import MemberRole
from app.schemas.workspace import (
    InviteCreate,
    InviteOut,
    MemberOut,
    MemberUpdate,
    WorkspaceCreate,
    WorkspaceOut,
    WorkspaceUpdate,
)
from app.services import invites as invites_service
from app.services import workspaces as workspaces_service
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["workspaces"])

Admin = Annotated[WorkspaceContext, Depends(require_role(MemberRole.admin))]
Owner = Annotated[WorkspaceContext, Depends(require_role(MemberRole.owner))]


@router.get("/workspaces")
async def list_workspaces(db: DbSession, user: CurrentUser) -> list[WorkspaceOut]:
    return await workspaces_service.list_for_user(db, user)


@router.post("/workspaces", status_code=status.HTTP_201_CREATED)
async def create_workspace(data: WorkspaceCreate, db: DbSession, user: CurrentUser) -> WorkspaceOut:
    return await workspaces_service.create(db, user, data.name)


@router.get("/workspaces/{ws_id}")
async def get_workspace(ctx: AnyMember) -> WorkspaceOut:
    return workspaces_service.to_out(ctx)


@router.patch("/workspaces/{ws_id}")
async def update_workspace(data: WorkspaceUpdate, db: DbSession, ctx: Admin) -> WorkspaceOut:
    return await workspaces_service.rename(db, ctx, data.name)


@router.delete("/workspaces/{ws_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(db: DbSession, ctx: Owner) -> None:
    await workspaces_service.delete(db, ctx)


@router.get("/workspaces/{ws_id}/members")
async def list_members(db: DbSession, ctx: AnyMember) -> list[MemberOut]:
    return await workspaces_service.list_members(db, ctx)


@router.patch("/workspaces/{ws_id}/members/{user_id}")
async def update_member(
    user_id: uuid.UUID, data: MemberUpdate, db: DbSession, ctx: Admin
) -> MemberOut:
    return await workspaces_service.update_member_role(db, ctx, user_id, MemberRole(data.role))


@router.delete("/workspaces/{ws_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(user_id: uuid.UUID, db: DbSession, ctx: Admin) -> None:
    await workspaces_service.remove_member(db, ctx, user_id)


@router.post("/workspaces/{ws_id}/invites", status_code=status.HTTP_201_CREATED)
async def create_invite(data: InviteCreate, db: DbSession, ctx: Admin) -> InviteOut:
    return await invites_service.create(db, ctx, data)


@router.post("/invites/{token}/accept")
async def accept_invite(token: str, db: DbSession, user: CurrentUser) -> WorkspaceOut:
    return await invites_service.accept(db, user, token)

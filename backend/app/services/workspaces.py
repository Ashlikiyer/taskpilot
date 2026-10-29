import re
import secrets
import unicodedata
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.db.models import MemberRole, User, Workspace, WorkspaceMember
from app.repositories import projects as projects_repo
from app.repositories import users as users_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.workspace import MemberOut, WorkspaceOut

ROLE_RANK = {
    MemberRole.viewer: 0,
    MemberRole.member: 1,
    MemberRole.admin: 2,
    MemberRole.owner: 3,
}


@dataclass(frozen=True)
class WorkspaceContext:
    """The current user's access to one workspace, resolved once per request."""

    workspace: Workspace
    user: User
    role: MemberRole

    def require(self, min_role: MemberRole) -> None:
        if ROLE_RANK[self.role] < ROLE_RANK[min_role]:
            raise ForbiddenError()


def _workspace_not_found() -> NotFoundError:
    return NotFoundError("Workspace not found", code="WORKSPACE_NOT_FOUND")


def _to_out(workspace: Workspace, role: MemberRole) -> WorkspaceOut:
    return WorkspaceOut(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        owner_id=workspace.owner_id,
        role=role,
        created_at=workspace.created_at,
    )


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:50].strip("-")
    return slug or "workspace"


async def _unique_slug(db: AsyncSession, name: str) -> str:
    base = slugify(name)
    candidate = base
    for _ in range(5):
        if not await workspaces_repo.slug_exists(db, candidate):
            return candidate
        candidate = f"{base}-{secrets.token_hex(2)}"
    raise AppError(409, "CONFLICT", "Could not generate a unique workspace URL, try another name")


async def get_context(db: AsyncSession, workspace_id: uuid.UUID, user: User) -> WorkspaceContext:
    """Resolve membership; non-members get 404 so workspace ids can't be probed."""
    membership = await workspaces_repo.get_membership(db, workspace_id, user.id)
    if membership is None:
        raise _workspace_not_found()
    workspace, member = membership
    return WorkspaceContext(workspace=workspace, user=user, role=member.role)


async def list_for_user(db: AsyncSession, user: User) -> list[WorkspaceOut]:
    rows = await workspaces_repo.list_for_user(db, user.id)
    return [_to_out(workspace, role) for workspace, role in rows]


async def create(db: AsyncSession, user: User, name: str) -> WorkspaceOut:
    workspace = await workspaces_repo.create(
        db, name=name, slug=await _unique_slug(db, name), owner_id=user.id
    )
    await workspaces_repo.add_member(db, workspace.id, user.id, MemberRole.owner)
    await db.commit()
    return _to_out(workspace, MemberRole.owner)


def to_out(ctx: WorkspaceContext) -> WorkspaceOut:
    return _to_out(ctx.workspace, ctx.role)


async def rename(db: AsyncSession, ctx: WorkspaceContext, name: str) -> WorkspaceOut:
    ctx.require(MemberRole.admin)
    ctx.workspace.name = name
    await db.commit()
    await db.refresh(ctx.workspace)
    return _to_out(ctx.workspace, ctx.role)


async def delete(db: AsyncSession, ctx: WorkspaceContext) -> None:
    ctx.require(MemberRole.owner)
    await workspaces_repo.delete_workspace(db, ctx.workspace)
    await db.commit()


def _member_out(member: WorkspaceMember, user: User) -> MemberOut:
    return MemberOut(
        user_id=user.id,
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        role=member.role,
        joined_at=member.created_at,
    )


async def list_members(db: AsyncSession, ctx: WorkspaceContext) -> list[MemberOut]:
    rows = await workspaces_repo.list_members(db, ctx.workspace.id)
    return [_member_out(member, user) for member, user in rows]


async def _get_changeable_member(
    db: AsyncSession, ctx: WorkspaceContext, user_id: uuid.UUID
) -> WorkspaceMember:
    """Admins may change or remove anyone except the owner."""
    ctx.require(MemberRole.admin)
    member = await workspaces_repo.get_member(db, ctx.workspace.id, user_id)
    if member is None:
        raise NotFoundError("Member not found")
    if member.role == MemberRole.owner:
        raise ForbiddenError("The workspace owner cannot be changed or removed")
    return member


async def update_member_role(
    db: AsyncSession, ctx: WorkspaceContext, user_id: uuid.UUID, role: MemberRole
) -> MemberOut:
    member = await _get_changeable_member(db, ctx, user_id)
    member.role = role
    await db.commit()
    user = await users_repo.get_by_id(db, user_id)
    assert user is not None
    return _member_out(member, user)


async def remove_member(db: AsyncSession, ctx: WorkspaceContext, user_id: uuid.UUID) -> None:
    member = await _get_changeable_member(db, ctx, user_id)
    await projects_repo.remove_user_from_workspace_projects(db, ctx.workspace.id, user_id)
    await workspaces_repo.delete_member(db, member)
    await db.commit()

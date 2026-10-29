import uuid

from sqlalchemy import delete, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole, User, Workspace, WorkspaceMember


async def create(db: AsyncSession, *, name: str, slug: str, owner_id: uuid.UUID) -> Workspace:
    workspace = Workspace(name=name, slug=slug, owner_id=owner_id)
    db.add(workspace)
    await db.flush()
    await db.refresh(workspace)
    return workspace


async def slug_exists(db: AsyncSession, slug: str) -> bool:
    result = await db.execute(select(exists().where(Workspace.slug == slug)))
    return bool(result.scalar())


async def delete_workspace(db: AsyncSession, workspace: Workspace) -> None:
    await db.execute(delete(Workspace).where(Workspace.id == workspace.id))


async def add_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID, role: MemberRole
) -> WorkspaceMember:
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role)
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


async def list_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Workspace, MemberRole]]:
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.name)
    )
    return [(workspace, role) for workspace, role in result.all()]


async def get_membership(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Workspace, WorkspaceMember] | None:
    result = await db.execute(
        select(Workspace, WorkspaceMember)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(Workspace.id == workspace_id, WorkspaceMember.user_id == user_id)
    )
    row = result.one_or_none()
    return (row[0], row[1]) if row else None


async def get_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> WorkspaceMember | None:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def get_member_by_email(
    db: AsyncSession, workspace_id: uuid.UUID, email: str
) -> WorkspaceMember | None:
    result = await db.execute(
        select(WorkspaceMember)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id, User.email == email.lower())
    )
    return result.scalar_one_or_none()


async def filter_member_ids(
    db: AsyncSession, workspace_id: uuid.UUID, user_ids: set[uuid.UUID]
) -> set[uuid.UUID]:
    """Return the subset of `user_ids` that are members of the workspace."""
    if not user_ids:
        return set()
    result = await db.execute(
        select(WorkspaceMember.user_id).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id.in_(user_ids)
        )
    )
    return set(result.scalars())


async def list_members(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[tuple[WorkspaceMember, User]]:
    result = await db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(User.name)
    )
    return [(member, user) for member, user in result.all()]


async def delete_member(db: AsyncSession, member: WorkspaceMember) -> None:
    await db.delete(member)
    await db.flush()

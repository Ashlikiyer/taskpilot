"""Helpers that create rows directly through repositories, for test setup."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.db.models import MemberRole, Project, User, Workspace
from app.repositories import projects as projects_repo
from app.repositories import users as users_repo
from app.repositories import workspaces as workspaces_repo

DEFAULT_PASSWORD = "correct-horse-battery"


async def create_user(
    db: AsyncSession, email: str = "ana@example.com", name: str = "Ana Santos"
) -> User:
    return await users_repo.create(
        db, email=email, name=name, password_hash=hash_password(DEFAULT_PASSWORD)
    )


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


async def create_workspace(
    db: AsyncSession, owner: User, name: str = "Acme", slug: str = "acme"
) -> Workspace:
    workspace = await workspaces_repo.create(db, name=name, slug=slug, owner_id=owner.id)
    await workspaces_repo.add_member(db, workspace.id, owner.id, MemberRole.owner)
    return workspace


async def add_member(db: AsyncSession, workspace: Workspace, email: str, role: MemberRole) -> User:
    user = await create_user(db, email=email, name=email.split("@")[0].title())
    await workspaces_repo.add_member(db, workspace.id, user.id, role)
    return user


async def create_project(
    db: AsyncSession, workspace: Workspace, members: list[User], name: str = "Website"
) -> Project:
    project = await projects_repo.create(
        db, workspace_id=workspace.id, name=name, description=None, color="#6366f1"
    )
    await projects_repo.set_members(db, project.id, {user.id for user in members})
    return project

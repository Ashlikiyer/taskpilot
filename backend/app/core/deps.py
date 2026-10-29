import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.models import MemberRole, User
from app.db.session import SessionLocal
from app.repositories import users as users_repo
from app.services import comments as comments_service
from app.services import projects as projects_service
from app.services import tasks as tasks_service
from app.services import workspaces as workspaces_service
from app.services.ai.provider import AIProvider, get_provider
from app.services.comments import CommentContext
from app.services.projects import ProjectContext
from app.services.tasks import TaskContext
from app.services.workspaces import WorkspaceContext


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise AppError(401, "UNAUTHENTICATED", "Not authenticated")
    user = await users_repo.get_by_id(db, decode_access_token(credentials.credentials))
    if user is None:
        raise AppError(401, "UNAUTHENTICATED", "Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_workspace_context(
    ws_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> WorkspaceContext:
    return await workspaces_service.get_context(db, ws_id, user)


AnyMember = Annotated[WorkspaceContext, Depends(get_workspace_context)]


async def get_project_context(
    project_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ProjectContext:
    return await projects_service.get_context(db, project_id, user)


ProjectAccess = Annotated[ProjectContext, Depends(get_project_context)]


async def get_task_context(task_id: uuid.UUID, db: DbSession, user: CurrentUser) -> TaskContext:
    return await tasks_service.get_context(db, task_id, user)


TaskAccess = Annotated[TaskContext, Depends(get_task_context)]


async def get_comment_context(
    comment_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> CommentContext:
    return await comments_service.get_context(db, comment_id, user)


CommentAccess = Annotated[CommentContext, Depends(get_comment_context)]


def get_ai_provider() -> AIProvider:
    """Overridden with a fake provider in tests."""
    return get_provider()


AI = Annotated[AIProvider, Depends(get_ai_provider)]


def require_role(min_role: MemberRole) -> Callable[..., Awaitable[WorkspaceContext]]:
    """Route dependency: the current user must have at least `min_role` in {ws_id}."""

    async def dependency(ctx: AnyMember) -> WorkspaceContext:
        ctx.require(min_role)
        return ctx

    return dependency

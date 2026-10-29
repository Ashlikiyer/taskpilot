from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_token, new_opaque_token
from app.db.models import MemberRole, User
from app.repositories import invites as invites_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.workspace import InviteCreate, InviteOut, WorkspaceOut
from app.services import workspaces as workspaces_service
from app.services.workspaces import WorkspaceContext


async def create(db: AsyncSession, ctx: WorkspaceContext, data: InviteCreate) -> InviteOut:
    """Create an invite link. The raw token is only returned here, never stored."""
    ctx.require(MemberRole.admin)
    if await workspaces_repo.get_member_by_email(db, ctx.workspace.id, data.email):
        raise ConflictError("This person is already a member of the workspace")

    settings = get_settings()
    raw, token_hash = new_opaque_token()
    invite = await invites_repo.create(
        db,
        workspace_id=ctx.workspace.id,
        email=data.email,
        role=MemberRole(data.role),
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(days=settings.invite_days),
    )
    await db.commit()
    return InviteOut(
        id=invite.id,
        email=invite.email,
        role=invite.role,
        expires_at=invite.expires_at,
        invite_url=f"{settings.frontend_origin}/invite/{raw}",
    )


async def accept(db: AsyncSession, user: User, raw_token: str) -> WorkspaceOut:
    now = datetime.now(UTC)
    invite = await invites_repo.get_by_hash(db, hash_token(raw_token))
    if invite is None or invite.accepted_at is not None or invite.expires_at <= now:
        raise NotFoundError("This invite link is invalid or has expired", code="INVITE_NOT_FOUND")
    if invite.email != user.email:
        raise ForbiddenError(f"This invite was sent to {invite.email}. Log in with that email.")

    if await workspaces_repo.get_member(db, invite.workspace_id, user.id) is None:
        await workspaces_repo.add_member(db, invite.workspace_id, user.id, invite.role)
    await invites_repo.mark_accepted(db, invite, now)
    await db.commit()

    ctx = await workspaces_service.get_context(db, invite.workspace_id, user)
    return workspaces_service.to_out(ctx)

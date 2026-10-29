from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError
from app.db.models import MemberRole
from app.repositories import labels as labels_repo
from app.schemas.task import LabelCreate, LabelOut
from app.services.workspaces import WorkspaceContext


async def list_labels(db: AsyncSession, ctx: WorkspaceContext) -> list[LabelOut]:
    labels = await labels_repo.list_for_workspace(db, ctx.workspace.id)
    return [LabelOut(id=lb.id, name=lb.name, color=lb.color) for lb in labels]


async def create(db: AsyncSession, ctx: WorkspaceContext, data: LabelCreate) -> LabelOut:
    ctx.require(MemberRole.member)
    if await labels_repo.get_by_name(db, ctx.workspace.id, data.name):
        raise ConflictError(f"A label named '{data.name}' already exists")
    try:
        label = await labels_repo.create(
            db, workspace_id=ctx.workspace.id, name=data.name, color=data.color
        )
        await db.commit()
    except IntegrityError as exc:  # two requests racing for the same name
        await db.rollback()
        raise ConflictError(f"A label named '{data.name}' already exists") from exc
    return LabelOut(id=label.id, name=label.name, color=label.color)

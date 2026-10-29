from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import AI, DbSession, require_role
from app.db.models import MemberRole
from app.schemas.ai import QuickAddDraft, QuickAddRequest
from app.services.ai import features
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["ai"])

Member = Annotated[WorkspaceContext, Depends(require_role(MemberRole.member))]


@router.post("/workspaces/{ws_id}/ai/quick-add")
async def quick_add(
    data: QuickAddRequest, db: DbSession, ctx: Member, provider: AI
) -> QuickAddDraft:
    """Draft a task from a sentence. Nothing is saved until the user confirms."""
    return await features.quick_add(db, ctx, provider, data)

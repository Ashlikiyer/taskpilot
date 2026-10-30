from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.deps import AI, CurrentUser, DbSession, TaskAccess, require_role
from app.db.models import MemberRole
from app.schemas.ai import (
    AIUsageOut,
    QuickAddDraft,
    QuickAddRequest,
    SubtaskSuggestions,
    ThreadSummaryOut,
)
from app.services.ai import features
from app.services.ai.runner import used_today
from app.services.workspaces import WorkspaceContext

router = APIRouter(tags=["ai"])

Member = Annotated[WorkspaceContext, Depends(require_role(MemberRole.member))]


@router.get("/ai/usage")
async def ai_usage(db: DbSession, user: CurrentUser) -> AIUsageOut:
    """How many of today's AI requests the current user has used."""
    return AIUsageOut(used=await used_today(db, user), limit=get_settings().ai_daily_limit_per_user)


@router.post("/workspaces/{ws_id}/ai/quick-add")
async def quick_add(
    data: QuickAddRequest, db: DbSession, ctx: Member, provider: AI
) -> QuickAddDraft:
    """Draft a task from a sentence. Nothing is saved until the user confirms."""
    return await features.quick_add(db, ctx, provider, data)


@router.post("/tasks/{task_id}/ai/subtasks")
async def suggest_subtasks(db: DbSession, ctx: TaskAccess, provider: AI) -> SubtaskSuggestions:
    """Suggest 3-8 subtasks. Nothing is saved; the user ticks which ones to create."""
    return await features.suggest_subtasks(db, ctx, provider)


@router.post("/tasks/{task_id}/ai/summary")
async def summarize_thread(db: DbSession, ctx: TaskAccess, provider: AI) -> ThreadSummaryOut:
    """Decisions, open questions and next steps from a thread of more than 5 comments."""
    return await features.summarize_thread(db, ctx, provider)

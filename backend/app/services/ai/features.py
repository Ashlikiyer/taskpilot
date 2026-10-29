"""AI features. Facts come from the database, words come from the AI: every id the
model returns is checked against the workspace before it reaches the user."""

import json
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemberRole
from app.repositories import labels as labels_repo
from app.repositories import projects as projects_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.ai import QuickAddDraft, QuickAddRequest
from app.services.ai import prompts
from app.services.ai.provider import AIProvider
from app.services.ai.runner import run_json
from app.services.dates import user_today
from app.services.workspaces import ROLE_RANK, WorkspaceContext


async def _usable_projects(db: AsyncSession, ctx: WorkspaceContext) -> dict[uuid.UUID, str]:
    """Active projects the user may add tasks to: all for admins, their own for members."""
    projects = await projects_repo.list_for_workspace(db, ctx.workspace.id, include_archived=False)
    if ROLE_RANK[ctx.role] >= ROLE_RANK[MemberRole.admin]:
        return {p.id: p.name for p in projects}
    members = await projects_repo.member_ids_by_project(db, (p.id for p in projects))
    return {p.id: p.name for p in projects if ctx.user.id in members[p.id]}


async def quick_add(
    db: AsyncSession, ctx: WorkspaceContext, provider: AIProvider, data: QuickAddRequest
) -> QuickAddDraft:
    """Turn one sentence into a task draft. Nothing is saved; the user confirms first."""
    ctx.require(MemberRole.member)  # viewers can't use AI features

    members = {
        user.id: user.name
        for member, user in await workspaces_repo.list_members(db, ctx.workspace.id)
        if member.role != MemberRole.viewer
    }
    projects = await _usable_projects(db, ctx)
    labels = {
        label.name.lower(): label.name
        for label in await labels_repo.list_for_workspace(db, ctx.workspace.id)
    }
    today = user_today(ctx.user.timezone)

    # Only the fields the feature needs: no emails, roles or other workspaces' data.
    context = {
        "TODAY": f"{today.isoformat()} ({today.strftime('%A')})",
        "MEMBERS": [{"id": str(uid), "name": name} for uid, name in members.items()],
        "PROJECTS": [{"id": str(pid), "name": name} for pid, name in projects.items()],
        "LABELS": list(labels.values()),
        "REQUEST": data.text,
    }
    draft = await run_json(
        db,
        provider,
        user=ctx.user,
        workspace_id=ctx.workspace.id,
        feature="quick_add",
        system=prompts.QUICK_ADD,
        prompt=json.dumps(context, ensure_ascii=False),
        schema=QuickAddDraft,
    )
    return _check_draft(draft, members, projects, labels, data.default_project_id, today)


def _check_draft(
    draft: QuickAddDraft,
    members: dict[uuid.UUID, str],
    projects: dict[uuid.UUID, str],
    labels: dict[str, str],
    default_project_id: uuid.UUID | None,
    today: date,
) -> QuickAddDraft:
    """Anything the AI got wrong becomes empty with a warning, never a guess."""
    warnings = list(draft.warnings)

    assignee_id = draft.assignee_id
    if assignee_id is not None and assignee_id not in members:
        warnings.append("Couldn't match the assignee to a workspace member, so it's unassigned.")
        assignee_id = None

    project_id = draft.project_id
    if project_id is not None and project_id not in projects:
        warnings.append("The suggested project isn't one you can add tasks to.")
        project_id = None
    if project_id is None and default_project_id in projects:
        project_id = default_project_id

    known_labels: list[str] = []
    for name in draft.labels:
        match = labels.get(name.strip().lower())
        if match is None:
            warnings.append(f'There is no label called "{name}", so it was left out.')
        elif match not in known_labels:
            known_labels.append(match)

    if draft.due_date is not None and draft.due_date < today:
        warnings.append("The due date is in the past.")

    return draft.model_copy(
        update={
            "title": draft.title.strip(),
            "assignee_id": assignee_id,
            "project_id": project_id,
            "labels": known_labels,
            "warnings": warnings[:10],
        }
    )

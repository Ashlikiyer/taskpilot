"""AI features. Facts come from the database, words come from the AI: every id the
model returns is checked against the workspace before it reaches the user."""

import json
import uuid
from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import MemberRole
from app.repositories import comments as comments_repo
from app.repositories import labels as labels_repo
from app.repositories import projects as projects_repo
from app.repositories import tasks as tasks_repo
from app.repositories import workspaces as workspaces_repo
from app.repositories.tasks import TaskFilters
from app.schemas.ai import (
    QuickAddDraft,
    QuickAddRequest,
    SubtaskSuggestions,
    ThreadSummary,
    ThreadSummaryOut,
)
from app.services import mentions
from app.services import tasks as tasks_service
from app.services.ai import prompts
from app.services.ai.provider import AIProvider
from app.services.ai.runner import run_json
from app.services.dates import user_today
from app.services.tasks import TaskContext
from app.services.workspaces import ROLE_RANK, WorkspaceContext

# Long descriptions are cut so a single request stays small and cheap.
MAX_DESCRIPTION_CHARS = 4000


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
    return check_draft(draft, members, projects, labels, data.default_project_id, today)


def check_draft(
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


async def suggest_subtasks(
    db: AsyncSession, ctx: TaskContext, provider: AIProvider
) -> SubtaskSuggestions:
    """Suggest subtasks for a top-level task. The user picks which ones to create."""
    ctx.project.workspace.require(MemberRole.member)
    await tasks_service.require_can_edit(db, ctx.project)
    task = ctx.task
    if task.parent_id is not None:
        raise AppError(400, "VALIDATION_ERROR", "Subtasks can't be broken down further")

    existing, _ = await tasks_repo.list_page(
        db, task.project_id, TaskFilters(parent_id=task.id), sort="position", page=1, page_size=100
    )
    context = {
        "TASK": task.title,
        "DESCRIPTION": (task.description or "")[:MAX_DESCRIPTION_CHARS] or None,
        "PROJECT": ctx.project.project.name,
        "EXISTING_SUBTASKS": [subtask.title for subtask in existing],
    }
    suggestions = await run_json(
        db,
        provider,
        user=ctx.project.workspace.user,
        workspace_id=ctx.project.project.workspace_id,
        feature="subtasks",
        system=prompts.SUBTASKS,
        prompt=json.dumps(context, ensure_ascii=False),
        schema=SubtaskSuggestions,
    )
    # The model is told not to repeat existing subtasks; make sure of it.
    seen = {subtask.title.strip().lower() for subtask in existing}
    unique: list[str] = []
    for title in suggestions.subtasks:
        if title.lower() not in seen:
            seen.add(title.lower())
            unique.append(title)
    return SubtaskSuggestions.model_construct(subtasks=unique)


SUMMARY_MIN_COMMENTS = 6  # the spec offers summaries when a task has more than 5 comments
MAX_SUMMARY_COMMENTS = 60
MAX_COMMENT_CHARS = 1500


async def summarize_thread(
    db: AsyncSession, ctx: TaskContext, provider: AIProvider
) -> ThreadSummaryOut:
    """Summarize a task's comments. Cached on the task until a comment changes."""
    ctx.project.workspace.require(MemberRole.member)
    task = ctx.task
    if task.summary is not None and task.summary_updated_at is not None:
        cached = ThreadSummary.model_validate(task.summary)
        return ThreadSummaryOut(
            **cached.model_dump(), generated_at=task.summary_updated_at, cached=True
        )

    comments = await comments_repo.list_for_task(db, task.id)
    if len(comments) < SUMMARY_MIN_COMMENTS:
        raise AppError(
            400,
            "VALIDATION_ERROR",
            "Summaries are available once a task has more than 5 comments.",
        )

    # First names and plain-text mentions only; no emails or ids go to the AI.
    context = {
        "TASK": task.title,
        "COMMENTS": [
            {
                "author": (name or "Former member").split()[0],
                "date": comment.created_at.date().isoformat(),
                "text": mentions.to_plain_text(comment.body)[:MAX_COMMENT_CHARS],
            }
            for comment, name in comments[-MAX_SUMMARY_COMMENTS:]
        ],
    }
    summary = await run_json(
        db,
        provider,
        user=ctx.project.workspace.user,
        workspace_id=ctx.project.project.workspace_id,
        feature="summary",
        system=prompts.THREAD_SUMMARY,
        prompt=json.dumps(context, ensure_ascii=False),
        schema=ThreadSummary,
    )
    task.summary = summary.model_dump()
    task.summary_updated_at = datetime.now(UTC)
    await db.commit()
    return ThreadSummaryOut(**task.summary, generated_at=task.summary_updated_at, cached=False)

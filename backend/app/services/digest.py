"""F9 daily digest: per user and workspace, built each morning by the scheduled job
(or on demand when someone opens the digest page first)."""

import json
import logging
from datetime import UTC, date, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Digest, MemberRole, Notification, NotificationType, User, Workspace
from app.repositories import digests as digests_repo
from app.repositories import notifications as notifications_repo
from app.schemas.digest import DigestContent, DigestOut, DigestRunResult, DigestSummary
from app.services import notifications as notifications_service
from app.services.ai import prompts
from app.services.ai.provider import AIProvider
from app.services.ai.runner import run_json
from app.services.dates import user_today
from app.services.digest_lists import build_lists
from app.services.workspaces import WorkspaceContext

logger = logging.getLogger(__name__)


def _ai_items(content: DigestContent, key: str) -> list[dict[str, str | None]]:
    """Only what the summary needs: title, project, due date and (for at risk) reason."""
    return [
        {
            "title": task.title,
            "project": task.project_name,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            **({"reason": task.reason} if task.reason else {}),
        }
        for task in getattr(content, key)
    ]


async def _summarize(
    db: AsyncSession,
    provider: AIProvider,
    workspace: Workspace,
    user: User,
    content: DigestContent,
    today: date,
) -> str | None:
    """Words from the AI; if it fails, the digest goes out without a summary."""
    context = {
        "TODAY": f"{today.isoformat()} ({today.strftime('%A')})",
        "NAME": user.name.split()[0],
        "OVERDUE": _ai_items(content, "overdue"),
        "DUE_TODAY": _ai_items(content, "due_today"),
        "AT_RISK": _ai_items(content, "at_risk"),
    }
    try:
        reply = await run_json(
            db,
            provider,
            user=user,
            workspace_id=workspace.id,
            feature="digest",
            system=prompts.DIGEST,
            prompt=json.dumps(context, ensure_ascii=False),
            schema=DigestSummary,
        )
    except AppError:
        logger.warning("Digest summary failed for user %s; sending without it", user.id)
        return None
    return reply.summary


async def build(
    db: AsyncSession,
    provider: AIProvider,
    workspace: Workspace,
    user: User,
    *,
    now: datetime | None = None,
) -> tuple[Digest, bool]:
    """Return today's digest for the user in this workspace, building it if needed.

    Returns (digest, created). Safe to call repeatedly: one digest per user,
    workspace and day.
    """
    now = now or datetime.now(UTC)
    today = user_today(user.timezone, now)
    existing = await digests_repo.get(db, user.id, workspace.id, today)
    if existing is not None:
        return existing, False

    rows = await digests_repo.open_assigned_tasks(db, workspace.id, user.id)
    content = build_lists(rows, today, now)
    summary = (
        None
        if content.is_empty()
        else await _summarize(db, provider, workspace, user, content, today)
    )
    try:
        digest = await digests_repo.add(
            db,
            Digest(
                user_id=user.id,
                workspace_id=workspace.id,
                date=today,
                content=content.model_dump(mode="json"),
                summary=summary,
            ),
        )
        if not content.is_empty():
            await notifications_repo.add(
                db,
                [
                    Notification(
                        user_id=user.id,
                        type=NotificationType.digest.value,
                        task_id=None,
                        payload={
                            "workspace_slug": workspace.slug,
                            "workspace_name": workspace.name,
                            "date": today.isoformat(),
                            "overdue": len(content.overdue),
                            "due_today": len(content.due_today),
                            "at_risk": len(content.at_risk),
                        },
                    )
                ],
            )
        await db.commit()
    except IntegrityError:
        # Built by a parallel request (page view vs. scheduled job): use that one.
        await db.rollback()
        existing = await digests_repo.get(db, user.id, workspace.id, today)
        if existing is None:
            raise
        return existing, False
    return digest, True


def to_out(digest: Digest) -> DigestOut:
    return DigestOut(
        id=digest.id,
        workspace_id=digest.workspace_id,
        date=digest.date,
        content=DigestContent.model_validate(digest.content),
        summary=digest.summary,
        created_at=digest.created_at,
    )


async def today_for(db: AsyncSession, ctx: WorkspaceContext, provider: AIProvider) -> DigestOut:
    """GET /workspaces/{id}/digest/today: the job may not have run yet (local dev,
    a new member), so the digest is built on first view."""
    ctx.require(MemberRole.member)
    digest, _ = await build(db, provider, ctx.workspace, ctx.user)
    if digest.read_at is None:
        digest.read_at = datetime.now(UTC)
        await db.commit()
    return to_out(digest)


async def run_daily(
    db: AsyncSession, provider: AIProvider, *, now: datetime | None = None
) -> DigestRunResult:
    """The scheduled job: a digest for every member of every workspace, plus the
    "due tomorrow" notifications. Running it twice in a day creates no duplicates."""
    created = notified = 0
    for workspace, user in await digests_repo.members_to_digest(db):
        try:
            digest, was_created = await build(db, provider, workspace, user, now=now)
        except Exception:
            # One person's failure must not stop everyone else's digest.
            logger.exception("Digest failed for user %s in workspace %s", user.id, workspace.id)
            await db.rollback()
            continue
        if was_created:
            created += 1
            if not DigestContent.model_validate(digest.content).is_empty():
                notified += 1
    due_tomorrow = await notifications_service.create_due_tomorrow(db, now)
    return DigestRunResult(
        digests_created=created,
        notifications_sent=notified,
        due_tomorrow_notifications=due_tomorrow,
    )

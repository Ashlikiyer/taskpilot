"""F10 intake: emails (via the Gmail Apps Script) and public form submissions become
task proposals in a project's Inbox. Admins accept (creating a task) or reject them.

Intake is the one place AI output is stored without a person confirming first, so
it only ever lands in the Inbox as a proposal.
"""

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ConflictError, NotFoundError
from app.db.models import (
    IntakeItem,
    IntakeSource,
    IntakeStatus,
    MemberRole,
    Project,
    TaskSource,
    User,
    Workspace,
)
from app.repositories import intake as intake_repo
from app.repositories import labels as labels_repo
from app.repositories import projects as projects_repo
from app.repositories import users as users_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.ai import QuickAddDraft
from app.schemas.intake import (
    EmailIntake,
    EmailIntakeResult,
    IntakeAccept,
    IntakeAIDraft,
    IntakeFormInfo,
    IntakeFormSubmission,
    IntakeItemOut,
)
from app.schemas.task import TaskCreate
from app.services import projects as projects_service
from app.services import tasks as tasks_service
from app.services.ai import prompts
from app.services.ai.features import check_draft
from app.services.ai.provider import AIProvider
from app.services.ai.runner import run_json
from app.services.dates import user_today
from app.services.email_cleanup import clean_email_body
from app.services.projects import ProjectContext

logger = logging.getLogger(__name__)

AI_BODY_CHARS = 4000  # the spec sends only the first 4,000 characters
STORED_BODY_CHARS = 20_000


@dataclass(frozen=True)
class IntakeContext:
    item: IntakeItem
    project: ProjectContext


def _not_found() -> NotFoundError:
    return NotFoundError("Intake item not found", code="INTAKE_ITEM_NOT_FOUND")


def _to_out(item: IntakeItem) -> IntakeItemOut:
    return IntakeItemOut.model_validate(
        {
            "id": item.id,
            "project_id": item.project_id,
            "source": item.source,
            "raw_subject": item.raw_subject,
            "raw_body": item.raw_body,
            "sender": item.sender,
            "draft": item.draft,
            "confidence": item.confidence,
            "status": item.status,
            "task_id": item.task_id,
            "created_at": item.created_at,
        }
    )


async def _draft(
    db: AsyncSession,
    provider: AIProvider,
    project: Project,
    *,
    subject: str,
    body: str,
    sender: str,
    received_at: datetime,
) -> tuple[QuickAddDraft, float]:
    """AI draft for the Inbox. If the AI fails, fall back to the subject and text so a
    request is never lost (confidence 0 tells the admin to check it)."""
    workspace = await db.get(Workspace, project.workspace_id)
    assert workspace is not None
    owner = await users_repo.get_by_id(db, workspace.owner_id)
    assert owner is not None
    cleaned = clean_email_body(body)

    # Only people who can work on this project: admins and owners, plus members of
    # it. Anyone else the AI picks becomes unassigned with a warning (check_draft).
    project_member_ids = (await projects_repo.member_ids_by_project(db, [project.id]))[project.id]
    members = {
        user.id: user.name
        for member, user in await workspaces_repo.list_members(db, workspace.id)
        if member.role in (MemberRole.owner, MemberRole.admin)
        or (member.role == MemberRole.member and user.id in project_member_ids)
    }
    labels = {
        label.name.lower(): label.name
        for label in await labels_repo.list_for_workspace(db, workspace.id)
    }
    today = user_today(owner.timezone)
    context = {
        "TODAY": f"{today.isoformat()} ({today.strftime('%A')})",
        "RECEIVED": received_at.isoformat(),
        "SENDER": sender,
        "SUBJECT": subject,
        "BODY": cleaned[:AI_BODY_CHARS],
        "PROJECT": project.name,
        "MEMBERS": [{"id": str(uid), "name": name} for uid, name in members.items()],
        "LABELS": list(labels.values()),
    }
    try:
        reply = await run_json(
            db,
            provider,
            user=owner,
            workspace_id=workspace.id,
            feature="intake",
            system=prompts.INTAKE,
            prompt=json.dumps(context, ensure_ascii=False),
            schema=IntakeAIDraft,
        )
    except AppError:
        logger.warning("Intake AI failed for project %s; storing the raw request", project.id)
        fallback = QuickAddDraft(
            title=(subject or cleaned.split("\n", 1)[0] or "New request")[:200],
            description=cleaned[:2000] or None,
            project_id=project.id,
            warnings=["The AI couldn't read this request. Please check the details."],
        )
        return fallback, 0.0

    draft = check_draft(
        QuickAddDraft.model_validate(reply.model_dump(exclude={"confidence"})),
        members,
        {project.id: project.name},
        labels,
        project.id,
        today,
    )
    # The project is decided by the label or form, never by the AI.
    return draft.model_copy(update={"project_id": project.id}), reply.confidence


async def receive_email(
    db: AsyncSession, provider: AIProvider, data: EmailIntake
) -> EmailIntakeResult:
    existing = await intake_repo.get_by_external_id(db, data.message_id)
    if existing is not None:
        return EmailIntakeResult(item_id=existing.id, duplicate=True)

    project = await projects_repo.get_by_intake_label(db, data.label)
    if project is None or project.archived_at is not None:
        raise NotFoundError(
            f'No active project is set up for the label "{data.label}"',
            code="INTAKE_ROUTE_NOT_FOUND",
        )

    draft, confidence = await _draft(
        db,
        provider,
        project,
        subject=data.subject,
        body=data.body,
        sender=data.sender,
        received_at=data.received_at,
    )
    try:
        item = await intake_repo.add(
            db,
            IntakeItem(
                project_id=project.id,
                source=IntakeSource.email.value,
                external_id=data.message_id,
                raw_subject=data.subject[:500] or "(no subject)",
                raw_body=data.body[:STORED_BODY_CHARS],
                sender=data.sender,
                draft=draft.model_dump(mode="json"),
                confidence=confidence,
            ),
        )
        await db.commit()
    except IntegrityError:
        # The script delivered the same message twice at once.
        await db.rollback()
        existing = await intake_repo.get_by_external_id(db, data.message_id)
        if existing is None:
            raise
        return EmailIntakeResult(item_id=existing.id, duplicate=True)
    return EmailIntakeResult(item_id=item.id, duplicate=False)


async def _form_project(db: AsyncSession, slug: str) -> Project:
    project = await projects_repo.get_by_intake_slug(db, slug)
    if project is None or not project.intake_form_enabled or project.archived_at is not None:
        raise NotFoundError("This request form isn't available", code="INTAKE_FORM_NOT_FOUND")
    return project


async def form_info(db: AsyncSession, slug: str) -> IntakeFormInfo:
    project = await _form_project(db, slug)
    workspace = await db.get(Workspace, project.workspace_id)
    assert workspace is not None
    return IntakeFormInfo(project_name=project.name, workspace_name=workspace.name)


async def submit_form(
    db: AsyncSession, provider: AIProvider, slug: str, data: IntakeFormSubmission
) -> None:
    project = await _form_project(db, slug)
    if data.website:
        logger.info("Dropped a form submission that filled the honeypot")
        return  # look successful so bots don't learn anything
    sender = f"{data.name} <{data.email}>"
    draft, confidence = await _draft(
        db,
        provider,
        project,
        subject=data.title,
        body=data.details,
        sender=sender,
        received_at=datetime.now(UTC),
    )
    await intake_repo.add(
        db,
        IntakeItem(
            project_id=project.id,
            source=IntakeSource.form.value,
            raw_subject=data.title,
            raw_body=data.details,
            sender=sender,
            draft=draft.model_dump(mode="json"),
            confidence=confidence,
        ),
    )
    await db.commit()


async def list_items(
    db: AsyncSession, ctx: ProjectContext, status: IntakeStatus | None
) -> list[IntakeItemOut]:
    ctx.workspace.require(MemberRole.admin)
    return [
        _to_out(item) for item in await intake_repo.list_for_project(db, ctx.project.id, status)
    ]


async def get_context(db: AsyncSession, item_id: uuid.UUID, user: User) -> IntakeContext:
    item = await intake_repo.get_by_id(db, item_id)
    if item is None:
        raise _not_found()
    try:
        project = await projects_service.get_context(db, item.project_id, user)
    except NotFoundError:
        raise _not_found() from None
    project.workspace.require(MemberRole.admin)
    return IntakeContext(item=item, project=project)


def _require_pending(item: IntakeItem) -> None:
    if item.status != IntakeStatus.pending.value:
        raise ConflictError(f"This request was already {item.status}.")


async def accept(db: AsyncSession, ctx: IntakeContext, edits: IntakeAccept) -> IntakeItemOut:
    """Create a task (source=intake) from the draft plus any edits made in the Inbox."""
    item = ctx.item
    _require_pending(item)
    draft = QuickAddDraft.model_validate(item.draft)
    sent = edits.model_fields_set

    if "label_ids" in sent and edits.label_ids is not None:
        label_ids = edits.label_ids
    else:
        by_name = {
            label.name.lower(): label.id
            for label in await labels_repo.list_for_workspace(db, ctx.project.project.workspace_id)
        }
        label_ids = [by_name[n.lower()] for n in draft.labels if n.lower() in by_name]

    # Fields the admin sent override the draft; title and priority can't be cleared.
    task_data = TaskCreate(
        title=edits.title if "title" in sent and edits.title else draft.title,
        description=edits.description if "description" in sent else draft.description,
        assignee_id=edits.assignee_id if "assignee_id" in sent else draft.assignee_id,
        due_date=edits.due_date if "due_date" in sent else draft.due_date,
        priority=edits.priority if "priority" in sent and edits.priority else draft.priority,
        label_ids=label_ids,
    )
    item.status = IntakeStatus.accepted.value  # committed together with the new task
    task = await tasks_service.create(db, ctx.project, task_data, source=TaskSource.intake)
    item.task_id = task.id
    await db.commit()
    await db.refresh(item)
    return _to_out(item)


async def reject(db: AsyncSession, ctx: IntakeContext) -> IntakeItemOut:
    _require_pending(ctx.item)
    ctx.item.status = IntakeStatus.rejected.value
    await db.commit()
    await db.refresh(ctx.item)
    return _to_out(ctx.item)

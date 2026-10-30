"""F11 steps 3 and 4: the dry-run preview and the all-or-nothing import.

Every row is checked against the spec's validation rules. The run re-checks the
rows instead of trusting an earlier preview, and inserts them in one transaction.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ConflictError, NotFoundError
from app.db.models import (
    ActivityLog,
    ImportStatus,
    MemberRole,
    Project,
    Task,
    TaskPriority,
    TaskSource,
    TaskStatus,
)
from app.repositories import activity as activity_repo
from app.repositories import imports as imports_repo
from app.repositories import labels as labels_repo
from app.repositories import projects as projects_repo
from app.repositories import tasks as tasks_repo
from app.repositories import workspaces as workspaces_repo
from app.schemas.imports import (
    ImportMapping,
    ImportOptions,
    ImportResult,
    PreviewResult,
    PreviewRow,
    PriorityValue,
    RowIssue,
    SkippedRow,
    StatusValue,
)
from app.services import positions
from app.services.import_values import PeopleIndex, Person, parse_date, split_labels
from app.services.imports import ImportContext, require_editable

logger = logging.getLogger(__name__)

MAX_TITLE = 200
MAX_DESCRIPTION = 20_000
PREVIEW_ROWS = 50
NEW_LABEL_COLOR = "#64748b"
STATUSES: tuple[StatusValue, ...] = ("todo", "in_progress", "in_review", "done")


@dataclass
class CheckedRow:
    """One spreadsheet row, translated and checked, ready to become a task."""

    number: int  # as shown in the spreadsheet (the header is row 1)
    original: dict[str, str | None]
    title: str | None
    description: str | None
    status: StatusValue
    priority: PriorityValue
    assignee: Person | None
    due_date: date | None
    labels: list[str]
    issues: list[RowIssue]

    @property
    def has_error(self) -> bool:
        return any(issue.level == "error" for issue in self.issues)

    def note(self, level: str, field: str, message: str) -> None:
        self.issues.append(
            RowIssue.model_validate({"level": level, "field": field, "message": message})
        )


async def _project_for(db: AsyncSession, ctx: ImportContext, project_id: uuid.UUID) -> Project:
    project = await projects_repo.get_by_id(db, project_id)
    if project is None or project.workspace_id != ctx.job.workspace_id:
        raise NotFoundError("Project not found", code="PROJECT_NOT_FOUND")
    if project.archived_at is not None:
        raise ConflictError("This project is archived. Restore it before importing.")
    return project


async def _people(db: AsyncSession, project: Project) -> tuple[PeopleIndex, PeopleIndex]:
    """(people who can be assigned in this project, everyone in the workspace)."""
    on_project = (await projects_repo.member_ids_by_project(db, [project.id]))[project.id]
    assignable: list[Person] = []
    everyone: list[Person] = []
    for member, user in await workspaces_repo.list_members(db, project.workspace_id):
        person = Person(user.id, user.name, user.email)
        everyone.append(person)
        if member.role in (MemberRole.owner, MemberRole.admin) or (
            member.role == MemberRole.member and user.id in on_project
        ):
            assignable.append(person)
    return PeopleIndex(assignable), PeopleIndex(everyone)


async def check_rows(
    db: AsyncSession, ctx: ImportContext, options: ImportOptions
) -> tuple[list[CheckedRow], list[str]]:
    """Apply the mapping to every row. Returns the rows and the label names to create."""
    job = ctx.job
    if job.mapping is None:
        raise AppError(400, "VALIDATION_ERROR", "Map the columns before previewing.")
    mapping = ImportMapping.model_validate(job.mapping)
    columns: dict[str, int] = {
        target: job.headers.index(header) for header, target in mapping.columns.items()
    }
    if "title" not in columns:
        raise AppError(400, "VALIDATION_ERROR", "Choose which column holds the task title.")

    project = await _project_for(db, ctx, options.project_id)
    assignable, everyone = await _people(db, project)
    existing = await tasks_repo.titles_and_due_dates(db, project.id)
    known_labels = {
        label.name.lower() for label in await labels_repo.list_for_workspace(db, job.workspace_id)
    }
    seen_in_file: set[tuple[str, date | None]] = set()
    new_labels: dict[str, str] = {}

    def cell(values: list[str | None], target: str) -> str | None:
        index = columns.get(target)
        return values[index] if index is not None else None

    rows: list[CheckedRow] = []
    for number, values in zip(job.row_numbers, job.rows, strict=True):
        description = cell(values, "description")
        row = CheckedRow(
            number=number,
            original=dict(zip(job.headers, values, strict=True)),
            title=cell(values, "title"),
            description=description[:MAX_DESCRIPTION] if description else None,
            status="todo",
            priority="medium",
            assignee=None,
            due_date=None,
            labels=split_labels(cell(values, "labels") or ""),
            issues=[],
        )

        # Missing title: error, row skipped. Over 200 characters: warning, shortened.
        if not row.title:
            row.note("error", "title", "Missing title, so this row is skipped.")
        elif len(row.title) > MAX_TITLE:
            row.note("warning", "title", "Title over 200 characters was shortened.")
            row.title = row.title[:MAX_TITLE]

        # Unknown status or priority: warning, set to todo / medium.
        if raw_status := cell(values, "status"):
            status = mapping.status_values.get(raw_status)
            if status is None:
                row.note("warning", "status", f'Unknown status "{raw_status}", set to To do.')
            else:
                row.status = status
        if raw_priority := cell(values, "priority"):
            priority = mapping.priority_values.get(raw_priority)
            if priority is None:
                row.note(
                    "warning", "priority", f'Unknown priority "{raw_priority}", set to Medium.'
                )
            else:
                row.priority = priority

        # Assignee not a member (or not on this project): warning, left unassigned.
        if raw_assignee := cell(values, "assignee"):
            row.assignee = assignable.match(raw_assignee)
            if row.assignee is None:
                row.note(
                    "warning",
                    "assignee",
                    f"{raw_assignee} isn't on this project, so the task is unassigned."
                    if everyone.match(raw_assignee)
                    else f'"{raw_assignee}" isn\'t a workspace member, so the task is unassigned.',
                )

        # Unparseable date: warning, left empty.
        if raw_due := cell(values, "due_date"):
            row.due_date = parse_date(raw_due, mapping.date_format)
            if row.due_date is None:
                row.note("warning", "due_date", f'Couldn\'t read the date "{raw_due}", left empty.')

        # Unknown labels: created automatically.
        for name in row.labels:
            if name.lower() not in known_labels and name.lower() not in new_labels:
                new_labels[name.lower()] = name
                row.note("info", "labels", f'New label "{name}" will be created.')

        # Same title and due date already in the project (or earlier in the file):
        # a warning, or skipped when duplicates aren't allowed.
        if row.title:
            key = (row.title.lower(), row.due_date)
            if key in existing or key in seen_in_file:
                if options.allow_duplicates:
                    row.note("warning", "title", "A task with this title and due date exists.")
                else:
                    row.note("error", "title", "Duplicate of an existing task, so it's skipped.")
            seen_in_file.add(key)

        rows.append(row)
    return rows, list(new_labels.values())


async def preview(db: AsyncSession, ctx: ImportContext, options: ImportOptions) -> PreviewResult:
    """Dry run: every row is checked, nothing is saved."""
    require_editable(ctx.job)
    rows, new_labels = await check_rows(db, ctx, options)
    ctx.job.project_id = options.project_id
    ctx.job.status = ImportStatus.previewed.value
    await db.commit()

    with_errors = sum(row.has_error for row in rows)
    with_warnings = sum(
        not row.has_error and any(issue.level == "warning" for issue in row.issues) for row in rows
    )
    return PreviewResult(
        total_rows=len(rows),
        valid_rows=len(rows) - with_errors,
        rows_with_warnings=with_warnings,
        rows_with_errors=with_errors,
        new_labels=new_labels,
        rows=[
            PreviewRow(
                row_number=row.number,
                title=row.title,
                description=row.description,
                status=row.status,
                priority=row.priority,
                assignee_name=row.assignee.name if row.assignee else None,
                due_date=row.due_date,
                labels=row.labels,
                issues=row.issues,
            )
            for row in rows[:PREVIEW_ROWS]
        ],
    )


async def _insert(
    db: AsyncSession,
    ctx: ImportContext,
    options: ImportOptions,
    valid: list[CheckedRow],
    new_label_names: list[str],
) -> list[Task]:
    job = ctx.job
    actor = ctx.workspace.user
    label_ids = {
        label.name.lower(): label.id
        for label in await labels_repo.list_for_workspace(db, job.workspace_id)
    }
    for name in new_label_names:
        label = await labels_repo.create(
            db, workspace_id=job.workspace_id, name=name, color=NEW_LABEL_COLOR
        )
        label_ids[name.lower()] = label.id

    # New tasks go to the bottom of their board column, in file order.
    next_position: dict[StatusValue, float] = {}
    for status in STATUSES:
        last = await tasks_repo.max_position(db, options.project_id, None, TaskStatus(status))
        next_position[status] = (last or 0) + positions.GAP

    now = datetime.now(UTC)
    tasks: list[Task] = []
    for row in valid:
        assert row.title is not None
        tasks.append(
            Task(
                id=uuid.uuid4(),
                project_id=options.project_id,
                title=row.title,
                description=row.description,
                status=TaskStatus(row.status),
                priority=TaskPriority(row.priority),
                assignee_id=row.assignee.user_id if row.assignee else None,
                due_date=row.due_date,
                position=next_position[row.status],
                created_by=actor.id,
                completed_at=now if row.status == "done" else None,
                source=TaskSource.import_.value,
            )
        )
        next_position[row.status] += positions.GAP

    await tasks_repo.add_many(db, tasks)
    await labels_repo.add_task_labels(
        db,
        [
            (task.id, label_ids[name.lower()])
            for task, row in zip(tasks, valid, strict=True)
            for name in row.labels
        ],
    )
    await activity_repo.add(
        db,
        [
            ActivityLog(
                workspace_id=job.workspace_id,
                task_id=task.id,
                actor_id=actor.id,
                action="created",
                new_value=task.title,
            )
            for task in tasks
        ],
    )
    return tasks


async def run(db: AsyncSession, ctx: ImportContext, options: ImportOptions) -> ImportResult:
    """Insert every valid row in ONE transaction: either all of them land, or none."""
    job = ctx.job
    require_editable(job)
    rows, new_label_names = await check_rows(db, ctx, options)  # never trust an old preview
    valid = [row for row in rows if not row.has_error]
    skipped = [
        SkippedRow(
            row_number=row.number,
            values=row.original,
            reasons=[issue.message for issue in row.issues if issue.level == "error"],
        )
        for row in rows
        if row.has_error
    ]
    job_id = job.id
    try:
        tasks = await _insert(db, ctx, options, valid, new_label_names)
        job.project_id = options.project_id
        job.status = ImportStatus.imported.value
        job.imported_rows = len(tasks)
        job.errors = [row.model_dump(mode="json") for row in skipped]
        await db.commit()
    except Exception as exc:
        # All or nothing: undo every task and label from this run, then record it.
        logger.exception("Import %s failed; nothing was saved", job_id)
        await db.rollback()
        failed = await imports_repo.get_by_id(db, job_id)
        if failed is not None:
            failed.status = ImportStatus.failed.value
            await db.commit()
        raise AppError(
            500, "IMPORT_FAILED", "The import failed and nothing was saved. Please try again."
        ) from exc

    return ImportResult(
        imported_rows=len(tasks), skipped_rows=skipped, labels_created=new_label_names
    )

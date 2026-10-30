"""Create the demo workspace ("Acme Studio") with people, projects, tasks, comments
and intake items, so every page has something to show.

Run from backend/:  uv run python ../scripts/seed.py
Running it again replaces the demo workspace (the demo users are kept).

Log in as demo@taskpilot.dev / taskpilot-demo (Kurt Alvarez, the owner).
"""

import asyncio
import random
import sys
import uuid
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.models import (  # noqa: E402
    ActivityLog,
    Comment,
    IntakeItem,
    Label,
    MemberRole,
    Project,
    ProjectMember,
    Task,
    TaskLabel,
    TaskPriority,
    TaskStatus,
    User,
    Workspace,
    WorkspaceMember,
)
from app.db.session import SessionLocal  # noqa: E402

PASSWORD = "taskpilot-demo"
SLUG = "acme-studio"

PEOPLE = [
    # (key, name, email, role)
    ("KA", "Kurt Alvarez", "demo@taskpilot.dev", MemberRole.owner),
    ("JS", "Jen Santos", "jen@acmestudio.ph", MemberRole.admin),
    ("MR", "Mark Reyes", "mark@acmestudio.ph", MemberRole.member),
    ("PC", "Paolo Cruz", "paolo@acmestudio.ph", MemberRole.member),
    ("AL", "Ana Lim", "ana@acmestudio.ph", MemberRole.member),
]

PROJECTS = [
    # (key, name, color, description, member keys)
    ("web", "Website Relaunch", "#3b6fe0", "New homepage, pricing and blog.", "KA JS MR PC AL"),
    ("q4", "Q4 Campaign", "#d97a1f", "Holiday email and social campaign.", "KA JS AL"),
    ("onb", "Client Onboarding", "#2f9e5b", "Kickoffs and setup for new clients.", "KA JS PC"),
    ("fin", "Finance Ops", "#c0478a", "Invoices, reports and renewals.", "KA JS MR"),
]

LABELS = {
    "content": "#3b6fe0",
    "copy": "#c0478a",
    "seo": "#d97a1f",
    "perf": "#d9443a",
    "launch": "#23864a",
    "design": "#6847e0",
    "legal": "#c98a12",
    "billing": "#64748b",
}

S = TaskStatus
P = TaskPriority

# (project, title, description, status, priority, assignee, due offset in days or None,
#  label, source, comments)
TASKS: list[tuple[str, str, str, TaskStatus, TaskPriority, str | None, int | None, str, str, int]] = [
    ("web", "Review pricing page copy", "Check tone and plan names against the new tiers.", S.todo, P.medium, "JS", 1, "copy", "ai_quick_add", 0),
    ("web", "Set up 301 redirects from old URLs", "Map 40 legacy URLs and test in staging.", S.todo, P.high, "PC", 5, "seo", "manual", 2),
    ("web", "Write alt text for hero and team photos", "Twelve images on the homepage and About page.", S.todo, P.low, "AL", 8, "content", "manual", 0),
    ("web", "Fix Lighthouse mobile score below 70", "LCP is 4.1s. Compress the hero and defer the chat widget.", S.in_progress, P.urgent, "KA", -2, "perf", "manual", 4),
    ("web", "Prepare launch checklist for the new homepage", "QA, analytics, redirects and rollback plan.", S.in_progress, P.high, "JS", 4, "launch", "manual", 7),
    ("web", "Approve new navigation component", "Mega-menu with keyboard support.", S.in_review, P.medium, "KA", 0, "design", "manual", 3),
    ("web", "Cookie banner legal copy", "Created from an email in the intake inbox.", S.in_review, P.high, "AL", 2, "legal", "intake", 0),
    ("q4", "Draft Q4 campaign email sequence", "Five emails from teaser to last call.", S.in_progress, P.high, "KA", 0, "copy", "manual", 1),
    ("q4", "Collect testimonials from 3 clients", "Short quotes plus a headshot each.", S.todo, P.low, "KA", None, "content", "ai_quick_add", 0),
    ("q4", "Plan holiday social calendar", "Two posts a week through December.", S.todo, P.medium, "AL", 9, "content", "import", 0),
    ("q4", "Design campaign landing page", "Reuse the new homepage blocks.", S.in_progress, P.medium, "JS", 6, "design", "manual", 2),
    ("onb", "Kickoff call notes for Brightline", "Three locations; owner wants weekly updates.", S.todo, P.low, "KA", 0, "content", "intake", 0),
    ("onb", "Acme onboarding deck", "Slides for the Acme kickoff.", S.in_progress, P.medium, "PC", 3, "design", "manual", 0),
    ("onb", "Send welcome pack to Northwind", "Logins, contacts and the first-month plan.", S.todo, P.medium, "PC", 2, "content", "import", 0),
    ("onb", "Collect brand assets from Brightline", "Logo files, fonts and photos.", S.todo, P.low, "JS", 10, "design", "import", 0),
    ("fin", "Send Q3 report to Northwind", "Hours, spend and next quarter's plan.", S.todo, P.high, "KA", -1, "billing", "manual", 1),
    ("fin", "Send the Acme invoice", "October retainer plus the extra landing page.", S.todo, P.high, "MR", 1, "billing", "ai_quick_add", 0),
    ("fin", "Renew SSL certificate for staging", "Expires in two weeks.", S.todo, P.medium, "MR", 6, "billing", "intake", 0),
    ("fin", "Reconcile October expenses", "Match receipts to the card statement.", S.in_review, P.medium, "JS", -3, "billing", "manual", 0),
]

CHECKLIST_SUBTASKS = [
    ("Run final Lighthouse and accessibility pass", True),
    ("Verify all 301 redirects resolve", True),
    ("QA forms and email notifications", False),
    ("Confirm analytics tags fire on key pages", False),
    ("Write rollback plan", False),
]

CHECKLIST_THREAD = [
    ("MR", "I'll run Lighthouse tonight. Mobile score is the blocker."),
    ("JS", "Thanks. Can we launch on the 4th if the score is above 80?"),
    ("KA", "Yes, launch on the 4th. Keep the old pricing page live behind a redirect."),
    ("PC", "Redirect map is done; testing it in staging today."),
    ("AL", "Who signs off on the legal copy for the cookie banner?"),
    ("JS", "Is the analytics tag approved by the client yet?"),
    ("KA", "Mark runs the Lighthouse pass; Jen finalises the checklist doc."),
]

# Completed tasks per week for the dashboard, oldest week first (8 weeks).
DONE_PER_WEEK = [9, 12, 8, 15, 14, 11, 19, 17]
DONE_TITLES = [
    "Migrate blog posts to new CMS",
    "Finalize color tokens",
    "Update team bios",
    "Send September invoice",
    "Schedule client check-in",
    "Fix broken footer links",
    "Draft newsletter",
    "Export analytics report",
    "Review contract renewal",
    "Resize product photos",
    "Write case study outline",
    "Set up staging site",
]

INTAKE = [
    ("fin", "email", "billing@acmecorp.com", "Re: October retainer: updated PO number",
     "Hi team, please reissue the October invoice using PO #4471-B instead of the old one. "
     "Our AP closes on the 5th, so we need it before then. Thanks!",
     "Reissue October invoice with PO #4471-B", P.high, 5, 0.91),
    ("onb", "form", "frontdesk@brightlinedental.ph", "Onboarding request: Brightline Dental, 3 locations",
     "We'd like to start onboarding for our three clinics next week. Main contact is Dr. Uy.",
     "Onboarding request: Brightline Dental, 3 locations", P.medium, 7, 0.84),
    ("web", "email", "jen@acmestudio.ph", "Client wants hero video swapped before launch",
     "The client sent a new hero video and wants it live before launch. File is in the shared drive.",
     "Swap the homepage hero video", P.medium, 3, 0.67),
    ("fin", "email", "noreply@vendor.io", "Renew SSL certificate for staging domain",
     "Your certificate for staging.acmestudio.ph expires in 14 days.",
     "Renew SSL certificate for staging domain", P.low, 12, 0.52),
]


def _today() -> date:
    return datetime.now(ZoneInfo(get_settings().app_timezone)).date()


def _at(day: date, hour: int = 10) -> datetime:
    zone = ZoneInfo(get_settings().app_timezone)
    return datetime.combine(day, time(hour), tzinfo=zone).astimezone(UTC)


async def _users(db: AsyncSession) -> dict[str, User]:
    users: dict[str, User] = {}
    for key, name, email, _ in PEOPLE:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, name=name, password_hash=hash_password(PASSWORD))
            db.add(user)
        else:
            user.name = name
            user.password_hash = hash_password(PASSWORD)
        users[key] = user
    await db.flush()
    return users


async def seed() -> None:
    rng = random.Random(7)
    today = _today()
    async with SessionLocal() as db:
        await db.execute(delete(Workspace).where(Workspace.slug == SLUG))
        users = await _users(db)
        owner = users["KA"]

        workspace = Workspace(name="Acme Studio", slug=SLUG, owner_id=owner.id)
        db.add(workspace)
        await db.flush()
        for key, _, _, role in PEOPLE:
            db.add(WorkspaceMember(workspace_id=workspace.id, user_id=users[key].id, role=role))

        projects: dict[str, Project] = {}
        for key, name, color, description, members in PROJECTS:
            project = Project(
                workspace_id=workspace.id, name=name, color=color, description=description
            )
            db.add(project)
            await db.flush()
            for member in members.split():
                db.add(ProjectMember(project_id=project.id, user_id=users[member].id))
            projects[key] = project

        labels = {name: Label(workspace_id=workspace.id, name=name, color=c) for name, c in LABELS.items()}
        db.add_all(labels.values())
        await db.flush()

        positions: dict[tuple[uuid.UUID, str], float] = {}

        def add_task(project: Project, title: str, **fields: object) -> Task:
            status = fields.get("status", S.todo)
            key = (project.id, str(status))
            positions[key] = positions.get(key, 0) + 1000
            created = fields.pop("created_at", _at(today - timedelta(days=rng.randint(10, 40))))
            task = Task(
                id=uuid.uuid4(),  # needed now for the activity entry below
                project_id=project.id,
                title=title,
                position=positions[key],
                created_by=owner.id,
                created_at=created,
                updated_at=created,
                **fields,
            )
            db.add(task)
            db.add(
                ActivityLog(
                    workspace_id=workspace.id,
                    task_id=task.id,
                    actor_id=owner.id,
                    action="created",
                    created_at=created,
                )
            )
            return task

        checklist: Task | None = None
        for (proj, title, desc, status, prio, who, due, label, source, n_comments) in TASKS:
            task = add_task(
                projects[proj],
                title,
                description=desc,
                status=status,
                priority=prio,
                assignee_id=users[who].id if who else None,
                due_date=today + timedelta(days=due) if due is not None else None,
                source=source,
            )
            await db.flush()
            db.add(TaskLabel(task_id=task.id, label_id=labels[label].id))
            if title.startswith("Prepare launch checklist"):
                checklist = task
            else:
                for i in range(n_comments):
                    author, body = CHECKLIST_THREAD[i % len(CHECKLIST_THREAD)]
                    db.add(
                        Comment(
                            task_id=task.id,
                            author_id=users[author].id,
                            body=body,
                            created_at=_at(today - timedelta(days=n_comments - i), 9 + i),
                        )
                    )

        assert checklist is not None
        for title, done in CHECKLIST_SUBTASKS:
            add_task(
                projects["web"],
                title,
                parent_id=checklist.id,
                status=S.done if done else S.todo,
                priority=P.medium,
                assignee_id=checklist.assignee_id,
                completed_at=_at(today - timedelta(days=1)) if done else None,
            )
        for i, (author, body) in enumerate(CHECKLIST_THREAD):
            text = body.replace("Jen", f"@[Jen Santos]({users['JS'].id})", 1) if i == 0 else body
            db.add(
                Comment(
                    task_id=checklist.id,
                    author_id=users[author].id,
                    body=text,
                    created_at=_at(today - timedelta(days=3)) + timedelta(hours=i * 3),
                )
            )

        # Completed work over the last 8 weeks, for the dashboard chart.
        week_start = today - timedelta(days=today.weekday())
        people = list(users.values())
        sources = ["manual"] * 6 + ["ai_quick_add", "ai_quick_add", "intake", "import"]
        for weeks_ago, count in enumerate(reversed(DONE_PER_WEEK)):
            start = week_start - timedelta(weeks=weeks_ago)
            for _ in range(count):
                day = start + timedelta(days=rng.randint(0, 6))
                if day > today:
                    day = today
                project = rng.choice(list(projects.values()))
                done_at = _at(day, rng.randint(9, 18))
                add_task(
                    project,
                    rng.choice(DONE_TITLES),
                    status=S.done,
                    priority=rng.choice(list(P)),
                    assignee_id=rng.choice(people).id,
                    due_date=day,
                    source=rng.choice(sources),
                    completed_at=done_at,
                    created_at=done_at - timedelta(days=rng.randint(2, 14)),
                )

        for proj, source, sender, subject, body, title, prio, due, confidence in INTAKE:
            db.add(
                IntakeItem(
                    project_id=projects[proj].id,
                    source=source,
                    external_id=f"seed-{uuid.uuid4()}" if source == "email" else None,
                    raw_subject=subject,
                    raw_body=body,
                    sender=sender,
                    draft={
                        "title": title,
                        "description": body,
                        "priority": prio.value,
                        "due_date": (today + timedelta(days=due)).isoformat(),
                        "assignee_id": None,
                        "project_id": str(projects[proj].id),
                        "labels": [],
                        "warnings": [],
                        "confidence": confidence,
                    },
                    confidence=confidence,
                )
            )

        await db.commit()
    print(f"Seeded the demo workspace. Log in as demo@taskpilot.dev / {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())

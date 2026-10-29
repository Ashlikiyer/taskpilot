import uuid
from datetime import UTC, date, datetime, timedelta

from app.db.models import Task, TaskPriority, TaskStatus
from app.services.digest_lists import build_lists

TODAY = date(2026, 10, 29)
NOW = datetime(2026, 10, 29, 0, 0, tzinfo=UTC)
FRESH = NOW - timedelta(hours=1)


def _task(title: str, *, due: date | None = None, status: TaskStatus = TaskStatus.todo) -> Task:
    return Task(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        title=title,
        status=status,
        priority=TaskPriority.medium,
        due_date=due,
    )


def _titles(tasks: list) -> list[str]:  # type: ignore[type-arg]
    return [t.title for t in tasks]


def test_overdue_and_due_today() -> None:
    rows = [
        (_task("late", due=TODAY - timedelta(days=3)), "Web", FRESH),
        (_task("today", due=TODAY, status=TaskStatus.in_review), "Web", FRESH),
        (_task("done late", due=TODAY - timedelta(days=1), status=TaskStatus.done), "Web", FRESH),
    ]

    content = build_lists(rows, TODAY, NOW)

    assert _titles(content.overdue) == ["late"]
    assert _titles(content.due_today) == ["today"]
    assert content.at_risk == []


def test_due_within_two_days_is_at_risk_only_while_todo() -> None:
    rows = [
        (_task("tomorrow todo", due=TODAY + timedelta(days=1)), "Web", FRESH),
        (_task("in two days todo", due=TODAY + timedelta(days=2)), "Web", FRESH),
        (_task("in three days", due=TODAY + timedelta(days=3)), "Web", FRESH),
        (
            _task("tomorrow started", due=TODAY + timedelta(days=1), status=TaskStatus.in_progress),
            "Web",
            FRESH,
        ),
    ]

    content = build_lists(rows, TODAY, NOW)

    assert _titles(content.at_risk) == ["tomorrow todo", "in two days todo"]
    assert {t.reason for t in content.at_risk} == {"due_soon"}


def test_in_progress_with_no_activity_for_five_days_is_stalled() -> None:
    rows = [
        (_task("stalled", status=TaskStatus.in_progress), "Web", NOW - timedelta(days=5)),
        (_task("active", status=TaskStatus.in_progress), "Web", NOW - timedelta(days=4, hours=23)),
        (_task("old todo"), "Web", NOW - timedelta(days=30)),
    ]

    content = build_lists(rows, TODAY, NOW)

    assert _titles(content.at_risk) == ["stalled"]
    assert content.at_risk[0].reason == "stalled"


def test_a_task_lands_in_one_list_only() -> None:
    overdue_and_stalled = _task(
        "both", due=TODAY - timedelta(days=1), status=TaskStatus.in_progress
    )

    content = build_lists([(overdue_and_stalled, "Web", NOW - timedelta(days=9))], TODAY, NOW)

    assert _titles(content.overdue) == ["both"]
    assert content.at_risk == []


def test_snapshot_keeps_display_fields() -> None:
    task = _task("Send invoice", due=TODAY)

    item = build_lists([(task, "Acme Website", FRESH)], TODAY, NOW).due_today[0]

    assert item.project_name == "Acme Website"
    assert item.status == "todo"
    assert item.due_date == TODAY
    assert item.reason is None

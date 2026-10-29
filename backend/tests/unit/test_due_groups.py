from datetime import UTC, date, datetime

import pytest

from app.db.models import Task
from app.repositories.tasks import prefix_tsquery
from app.services.search import due_group, group_by_due, user_today

WEDNESDAY = date(2026, 10, 28)
SUNDAY = date(2026, 11, 1)


@pytest.mark.parametrize(
    ("due", "group"),
    [
        (None, "no_date"),
        (date(2026, 10, 27), "overdue"),
        (WEDNESDAY, "due_today"),
        (date(2026, 10, 29), "this_week"),
        (SUNDAY, "this_week"),
        (date(2026, 11, 2), "later"),
    ],
)
def test_due_group_midweek(due: date | None, group: str) -> None:
    assert due_group(due, WEDNESDAY) == group


def test_on_sunday_tomorrow_is_already_next_week() -> None:
    assert due_group(date(2026, 11, 2), SUNDAY) == "later"


def test_group_by_due_keeps_order() -> None:
    tasks = [Task(title=t, due_date=d) for t, d in [("a", None), ("b", WEDNESDAY), ("c", None)]]

    groups = group_by_due(tasks, WEDNESDAY)

    assert [t.title for t in groups["no_date"]] == ["a", "c"]
    assert [t.title for t in groups["due_today"]] == ["b"]


def test_today_uses_the_users_timezone() -> None:
    # 17:00 UTC on Oct 28 is already Oct 29 in Manila (UTC+8).
    now = datetime(2026, 10, 28, 17, 0, tzinfo=UTC)

    assert user_today("Asia/Manila", now) == date(2026, 10, 29)
    assert user_today("UTC", now) == date(2026, 10, 28)
    assert user_today("Not/AZone", now) == date(2026, 10, 29)  # falls back to app default


@pytest.mark.parametrize(
    ("text", "query"),
    [
        ("acme inv", "acme:* & inv:*"),
        ("  Acme!!  ", "acme:*"),
        ("a & b | !c", "a:* & b:* & c:*"),
        ("café", "café:*"),
        ("!!!", None),
        ("", None),
    ],
)
def test_prefix_tsquery_is_safe(text: str, query: str | None) -> None:
    assert prefix_tsquery(text) == query

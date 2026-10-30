import uuid
from datetime import date

import pytest

from app.services.import_values import (
    PeopleIndex,
    Person,
    best_date_format,
    guess_priority,
    guess_status,
    parse_date,
    split_labels,
)


@pytest.mark.parametrize(
    ("raw", "status"),
    [
        ("WIP", "in_progress"),
        ("Closed", "done"),
        ("open", "todo"),
        ("In_Review", "in_review"),
        ("Blocked", None),
        ("Cancelled", None),
    ],
)
def test_guess_status(raw: str, status: str | None) -> None:
    assert guess_status(raw) == status


@pytest.mark.parametrize(
    ("raw", "priority"),
    [
        ("P1", "urgent"),
        ("URGENT", "urgent"),
        ("p2", "high"),
        ("Normal", "medium"),
        ("Low", "low"),
        ("whenever", None),
    ],
)
def test_guess_priority(raw: str, priority: str | None) -> None:
    assert guess_priority(raw) == priority


@pytest.mark.parametrize(
    ("raw", "fmt", "expected"),
    [
        ("2026-11-03", None, date(2026, 11, 3)),
        ("2026-11-03 00:00:00", None, date(2026, 11, 3)),
        ("11/05/2026", "%m/%d/%Y", date(2026, 11, 5)),
        ("11/05/2026", "%d/%m/%Y", date(2026, 5, 11)),
        ("Nov 10, 2026", "%m/%d/%Y", date(2026, 11, 10)),  # falls back to named formats
        ("14/11/2026", "%m/%d/%Y", None),  # day-first doesn't fit a month-first file
        ("soon-ish", None, None),
        ("11/05/2026", None, None),  # ambiguous without a format: never guessed
    ],
)
def test_parse_date(raw: str, fmt: str | None, expected: date | None) -> None:
    assert parse_date(raw, fmt) == expected


def test_split_labels() -> None:
    assert split_labels(" Billing, Client;billing | Bug ,, ") == ["Billing", "Client", "Bug"]


def test_people_matching_order() -> None:
    mark = Person(uuid.uuid4(), "Mark Santos", "mark@example.com")
    ana = Person(uuid.uuid4(), "Ana Cruz", "ana.cruz@example.com")
    ana2 = Person(uuid.uuid4(), "Ana Reyes", "ana.reyes@example.com")
    people = PeopleIndex([mark, ana, ana2])

    assert people.match("MARK@example.com") is mark
    assert people.match("mark santos") is mark
    assert people.match("Mark") is mark  # unique first name
    assert people.match("ana") is None  # two Anas: no guess
    assert people.match("Ana Cruz") is ana
    assert people.match("Mrak Santos") is None  # misspelled: no fuzzy guessing
    assert people.match("") is None


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        (["2026-11-03", "Nov 10, 2026"], None),  # already readable without a format
        (["11/05/2026", "12/31/2026"], "%m/%d/%Y"),  # 12/31 only works month-first
        (["11/05/2026", "31/12/2026"], "%d/%m/%Y"),  # 31/12 only works day-first
        (["11/05/2026"], "%m/%d/%Y"),  # a tie goes to month-first
        (["05.11.2026"], "%d.%m.%Y"),
        (["soon-ish", "tbd"], None),  # nothing fits
    ],
)
def test_best_date_format(values: list[str], expected: str | None) -> None:
    assert best_date_format(values) == expected

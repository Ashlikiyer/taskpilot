"""Turning spreadsheet text into task values. All deterministic Python: the AI only
suggests the mapping, it never decides who a person is or what a date means."""

import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime

from app.schemas.imports import PriorityValue, StatusValue

# Common words from other tools. Anything not listed stays unmapped (the user picks,
# or the row gets a warning and the default).
_STATUS_WORDS: dict[StatusValue, set[str]] = {
    "todo": {"todo", "to do", "to-do", "open", "new", "backlog", "not started", "pending"},
    "in_progress": {"in progress", "in-progress", "wip", "doing", "started", "ongoing", "active"},
    "in_review": {"in review", "review", "reviewing", "qa", "testing", "waiting for review"},
    "done": {"done", "closed", "complete", "completed", "finished", "resolved", "shipped"},
}
_PRIORITY_WORDS: dict[PriorityValue, set[str]] = {
    "urgent": {"urgent", "p0", "p1", "critical", "highest", "blocker", "asap"},
    "high": {"high", "p2", "important"},
    "medium": {"medium", "p3", "normal", "med"},
    "low": {"low", "p4", "p5", "lowest", "minor"},
}

# Tried after the mapping's own date format, in order. Ambiguous day/month formats
# are deliberately left to the mapping, which the user can see and change.
_FALLBACK_DATE_FORMATS = ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y")


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower().replace("_", " "))


def guess_status(value: str) -> StatusValue | None:
    word = _normalize(value)
    return next((status for status, words in _STATUS_WORDS.items() if word in words), None)


def guess_priority(value: str) -> PriorityValue | None:
    word = _normalize(value)
    return next((prio for prio, words in _PRIORITY_WORDS.items() if word in words), None)


def parse_date(value: str, date_format: str | None) -> date | None:
    text = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}[T ][\d:.]+", text):  # ISO date-time from Excel
        text = text[:10]
    for fmt in (date_format, *_FALLBACK_DATE_FORMATS):
        if not fmt:
            continue
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


# Candidates when the mapping has no date format; ambiguous ones are in common use.
_CANDIDATE_DATE_FORMATS = ("%m/%d/%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y/%m/%d", "%m-%d-%Y", "%d-%m-%Y")


def best_date_format(values: list[str]) -> str | None:
    """The candidate format that reads the most values, or None when ISO dates (or
    named months) already cover them. On a tie, month-first wins (listed first)."""
    unread = [v for v in values if parse_date(v, None) is None]
    if not unread:
        return None
    scores = {
        fmt: sum(parse_date(v, fmt) is not None for v in unread) for fmt in _CANDIDATE_DATE_FORMATS
    }
    best = max(_CANDIDATE_DATE_FORMATS, key=lambda fmt: scores[fmt])
    return best if scores[best] > 0 else None


def split_labels(value: str) -> list[str]:
    names: list[str] = []
    for part in re.split(r"[,;|]", value):
        name = part.strip()[:50]
        if name and name.lower() not in {n.lower() for n in names}:
            names.append(name)
    return names[:20]


@dataclass(frozen=True)
class Person:
    user_id: uuid.UUID
    name: str
    email: str


class PeopleIndex:
    """Match a cell to a member: exact email, then full name (any case), then first
    name when exactly one member has it. Anything else is no match, never a guess."""

    def __init__(self, people: list[Person]) -> None:
        self._by_email = {p.email.lower(): p for p in people}
        self._by_name = {_normalize(p.name): p for p in people}
        first: dict[str, list[Person]] = {}
        for person in people:
            first.setdefault(_normalize(person.name).split(" ")[0], []).append(person)
        self._by_first = {name: group[0] for name, group in first.items() if len(group) == 1}

    def match(self, value: str) -> Person | None:
        text = _normalize(value)
        if not text:
            return None
        return self._by_email.get(text) or self._by_name.get(text) or self._by_first.get(text)

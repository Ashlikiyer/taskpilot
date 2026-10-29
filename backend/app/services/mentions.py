"""@mentions in comments.

The comment box inserts mentions as `@[Display Name](user-id)`, so a mention points
at one exact person even when two members share a name. The id is what counts;
the name is only for display and is never trusted.
"""

import re
import uuid

MENTION = re.compile(r"@\[([^\]\n]{1,100})\]\(([0-9a-fA-F-]{36})\)")
MAX_MENTIONS = 20


def mentioned_user_ids(body: str) -> set[uuid.UUID]:
    ids: set[uuid.UUID] = set()
    for match in MENTION.finditer(body):
        try:
            ids.add(uuid.UUID(match.group(2)))
        except ValueError:
            continue
        if len(ids) >= MAX_MENTIONS:
            break
    return ids


def to_plain_text(body: str) -> str:
    """`@[Mark Santos](id)` -> `@Mark Santos`, for notification previews."""
    return MENTION.sub(lambda m: f"@{m.group(1)}", body)


def excerpt(body: str, length: int = 120) -> str:
    text = " ".join(to_plain_text(body).split())
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"

"""Strip what isn't the request itself from an email before the AI sees it:
quoted replies, earlier messages in the thread, signatures and legal disclaimers.

Less text means a cheaper, more accurate draft, and fewer places for instructions
hidden in old quoted mail to reach the model.
"""

import re

# Everything from one of these lines down is an earlier message in the thread.
_THREAD_STARTS = [
    re.compile(r"^-{2,}\s*original message\s*-{2,}\s*$", re.IGNORECASE),
    re.compile(r"^_{8,}\s*$"),  # Outlook's separator line
    re.compile(r"^-{2,}\s*forwarded message\s*-{2,}\s*$", re.IGNORECASE),
]
_ON_WROTE = re.compile(r"^on\b.{0,300}\bwrote:\s*$", re.IGNORECASE)
_HEADER = re.compile(r"^(from|sent|date|to|subject|cc):\s", re.IGNORECASE)

# Everything from one of these lines down is a signature or disclaimer.
_TAIL_STARTS = [
    re.compile(r"^--\s*$"),  # the standard signature delimiter ("-- ")
    re.compile(
        r"^(confidentiality notice|disclaimer|this (e-?mail|message|communication)"
        r"( and any (files|attachments)[^.]*)? (is|are|may be|contains) (strictly )?"
        r"(confidential|privileged|intended))",
        re.IGNORECASE,
    ),
]
_MOBILE_FOOTER = re.compile(r"^(sent from my \w+|get outlook for \w+)", re.IGNORECASE)


def _is_outlook_header(lines: list[str], index: int) -> bool:
    """`From: …` followed closely by `Sent:`/`Date:` and `To:`/`Subject:` lines."""
    if not lines[index].lower().startswith("from:"):
        return False
    following = [line for line in lines[index + 1 : index + 5] if _HEADER.match(line)]
    return len(following) >= 2


def clean_email_body(body: str) -> str:
    lines = body.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    kept: list[str] = []
    for index, raw in enumerate(lines):
        line = raw.strip()
        joined = f"{lines[index - 1].strip()} {line}" if index else line
        if (
            any(pattern.match(line) for pattern in _THREAD_STARTS)
            or _ON_WROTE.match(line)
            or (line.lower().endswith("wrote:") and _ON_WROTE.match(joined))
            or _is_outlook_header(lines, index)
        ):
            if not _ON_WROTE.match(line) and _ON_WROTE.match(joined) and kept:
                kept.pop()  # the "On <date>," part was on the previous line
            break
        if any(pattern.match(line) for pattern in _TAIL_STARTS):
            break
        if line.startswith(">") or _MOBILE_FOOTER.match(line):
            continue
        kept.append(raw.rstrip())

    text = "\n".join(kept).strip()
    return re.sub(r"\n{3,}", "\n\n", text)

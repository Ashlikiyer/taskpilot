"""Generate scripts/samples/messy_tasks.xlsx, the spec's demo and test file for F11.

It mimics an export from another tool: an odd header row, mixed date formats,
statuses like "WIP" and "Closed", priorities like "P1", blank rows, a misspelled
member name, a missing title and a second sheet.

Run from backend/:  uv run python ../scripts/samples/make_messy_tasks.py
"""

from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

OUT = Path(__file__).with_name("messy_tasks.xlsx")

HEADERS = ["Task Name", "Notes", "Owner", "State", "Prio", "Deadline", "Tags", "Internal ID"]
ROWS: list[list[object]] = [
    ["Send the Acme invoice", "Use the new rate", "mark@example.com", "WIP", "P1", "2026-11-03", "Billing, Client", "A-101"],
    ["Update pricing page", None, "Mark Santos", "Open", "P2", "11/05/2026", "Website", "A-102"],
    ["Book the photo shoot", "Studio on 5th", "ana", "todo", "Low", datetime(2026, 11, 7), None, "A-103"],
    [None, None, None, None, None, None, None, None],
    ["Review homepage copy", None, "Mrak Santos", "Review", "P3", "Nov 10, 2026", "Website", "A-104"],
    ["Fix contact form", "Errors on submit", "Olive Reyes", "Closed", "URGENT", "soon-ish", "Website, Bug", "A-105"],
    [None, "Row with no title", "ana", "Open", "P2", "2026-11-12", None, "A-106"],
    ["Plan Q1 campaign", None, "someone@else.com", "Blocked", "Medium", None, "Marketing", "A-107"],
    ["Write blog post " + "x" * 210, None, None, "Done", "P2", "2026-11-14", None, "A-108"],
    [None, None, None, None, None, None, None, None],
    ["Archive old assets", None, "Olive", "Cancelled", "P4", "14/11/2026", None, "A-109"],
]


def main() -> None:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.title = "Tasks export"
    sheet.append(HEADERS)
    for row in ROWS:
        sheet.append(row)
    notes = book.create_sheet("Read me")
    notes.append(["This sheet is not tasks; pick 'Tasks export' when importing."])
    book.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

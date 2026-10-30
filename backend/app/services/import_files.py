"""Read an uploaded .csv or .xlsx into plain text cells.

Files are parsed in memory and only their values are kept. Nothing in them is
executed: formulas come through as whatever value Excel last saved, never evaluated.
"""

import io
import math
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import PurePath

import pandas as pd

from app.core.errors import AppError

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 2000
MAX_COLUMNS = 50
MAX_CELL_CHARS = 5000
ALLOWED = {".csv", ".xlsx"}


@dataclass(frozen=True)
class ParsedFile:
    headers: list[str]
    rows: list[list[str | None]]
    # Where each row is in the spreadsheet (the header is usually row 1), so messages
    # point at the right row even after blank rows are dropped.
    row_numbers: list[int]
    sheet_names: list[str]
    sheet: str | None


def _bad_file(message: str) -> AppError:
    return AppError(400, "VALIDATION_ERROR", message)


def _cell(value: object) -> str | None:
    """Excel and CSV values as text; dates become ISO strings, 3.0 becomes "3"."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, pd.Timestamp):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        return (value.date() if value.time() == datetime.min.time() else value).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text[:MAX_CELL_CHARS] or None


def _headers(raw: list[object]) -> list[str]:
    """Blank headers become "Column 3"; repeated ones get "(2)", "(3)"."""
    seen: dict[str, int] = {}
    headers: list[str] = []
    for index, value in enumerate(raw, start=1):
        name = (_cell(value) or f"Column {index}")[:100]
        count = seen.get(name.lower(), 0) + 1
        seen[name.lower()] = count
        headers.append(name if count == 1 else f"{name} ({count})")
    return headers


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("latin-1")


def read_table(file_name: str, content: bytes, sheet: str | None = None) -> ParsedFile:
    extension = PurePath(file_name).suffix.lower()
    if extension not in ALLOWED:
        raise _bad_file("Upload a .csv or .xlsx file.")
    if len(content) > MAX_BYTES:
        raise _bad_file("The file is larger than 5 MB.")
    if not content:
        raise _bad_file("The file is empty.")

    sheet_names: list[str] = []
    try:
        if extension == ".csv":
            frame = pd.read_csv(
                io.StringIO(_decode_csv(content)),
                header=None,
                dtype=str,
                keep_default_na=False,
                skip_blank_lines=False,  # keep line positions for row numbers
            )
        else:
            book = pd.ExcelFile(io.BytesIO(content), engine="openpyxl")
            sheet_names = [str(name) for name in book.sheet_names]
            if sheet is not None and sheet not in sheet_names:
                raise _bad_file(f'There is no sheet called "{sheet}" in this file.')
            sheet = sheet or sheet_names[0]
            frame = pd.read_excel(book, sheet_name=sheet, header=None)
    except AppError:
        raise
    except Exception as exc:  # pandas/openpyxl raise many types for broken files
        raise _bad_file(
            "We couldn't read this file. Check that it's a valid CSV or Excel file."
        ) from exc

    # (spreadsheet row number, cells), without the empty rows.
    numbered: list[tuple[int, list[str | None]]] = []
    for position, row in enumerate(frame.itertuples(index=False)):
        cells = [_cell(value) for value in row]
        if any(cell is not None for cell in cells):
            numbered.append((position + 1, cells))
    if not numbered:
        raise _bad_file("The file has no rows.")
    table = [cells for _, cells in numbered]

    headers = _headers(list(table[0]))
    rows = table[1:]
    # Drop columns with no header and no values anywhere.
    keep = [
        i
        for i, header in enumerate(headers)
        if table[0][i] is not None or any(i < len(row) and row[i] is not None for row in rows)
    ]
    if len(keep) > MAX_COLUMNS:
        raise _bad_file(f"The file has more than {MAX_COLUMNS} columns.")
    if not rows:
        raise _bad_file("The file has a header row but no tasks.")
    if len(rows) > MAX_ROWS:
        raise _bad_file(f"The file has {len(rows)} rows; the limit is {MAX_ROWS}.")

    return ParsedFile(
        headers=[headers[i] for i in keep],
        rows=[[row[i] if i < len(row) else None for i in keep] for row in rows],
        row_numbers=[number for number, _ in numbered[1:]],
        sheet_names=sheet_names,
        sheet=sheet if extension == ".xlsx" else None,
    )

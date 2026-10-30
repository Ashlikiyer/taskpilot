import io
from datetime import datetime
from pathlib import Path

import pytest
from openpyxl import Workbook

from app.core.errors import AppError
from app.services.import_files import MAX_ROWS, read_table

SAMPLE = Path(__file__).resolve().parents[3] / "scripts" / "samples" / "messy_tasks.xlsx"


def _xlsx(sheets: dict[str, list[list[object]]]) -> bytes:
    book = Workbook()
    book.remove(book.active)  # type: ignore[arg-type]
    for name, rows in sheets.items():
        sheet = book.create_sheet(name)
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    book.save(buffer)
    return buffer.getvalue()


def _error(file_name: str, content: bytes, sheet: str | None = None) -> str:
    with pytest.raises(AppError) as error:
        read_table(file_name, content, sheet)
    return error.value.message


def test_reads_csv_as_text_and_drops_blank_rows() -> None:
    content = b"Title,Due,Points\nSend invoice,2026-11-03,3\n,,\nCall Acme,,N/A\n"

    parsed = read_table("tasks.CSV", content)

    assert parsed.headers == ["Title", "Due", "Points"]
    assert parsed.rows == [["Send invoice", "2026-11-03", "3"], ["Call Acme", None, "N/A"]]
    assert parsed.sheet is None


def test_reads_windows_encoded_csv() -> None:
    parsed = read_table("tasks.csv", "Title\nCafé meeting\n".encode("cp1252"))

    assert parsed.rows == [["Café meeting"]]


def test_names_blank_and_repeated_headers() -> None:
    parsed = read_table("tasks.csv", b"Title,,Title,Notes\na,b,c,\n")

    assert parsed.headers == ["Title", "Column 2", "Title (2)", "Notes"]


def test_excel_dates_and_numbers_become_plain_text() -> None:
    content = _xlsx({"Sheet": [["Title", "Due", "Hours"], ["Plan", datetime(2026, 11, 7), 3.0]]})

    parsed = read_table("tasks.xlsx", content)

    assert parsed.rows == [["Plan", "2026-11-07", "3"]]


def test_choose_a_sheet() -> None:
    content = _xlsx({"Notes": [["hello"], ["x"]], "Tasks": [["Title"], ["Real task"]]})

    first = read_table("tasks.xlsx", content)
    chosen = read_table("tasks.xlsx", content, sheet="Tasks")

    assert first.sheet_names == ["Notes", "Tasks"]
    assert first.sheet == "Notes"
    assert chosen.rows == [["Real task"]]
    assert "no sheet called" in _error("tasks.xlsx", content, sheet="Missing")


@pytest.mark.parametrize(
    ("file_name", "content", "message"),
    [
        ("tasks.xls", b"Title\nx\n", "Upload a .csv or .xlsx file."),
        ("tasks.exe", b"MZ", "Upload a .csv or .xlsx file."),
        ("tasks.csv", b"", "The file is empty."),
        ("tasks.csv", b"Title\n", "The file has a header row but no tasks."),
        ("tasks.xlsx", b"not really a zip file", "We couldn't read this file"),
    ],
)
def test_rejects_bad_files(file_name: str, content: bytes, message: str) -> None:
    assert message in _error(file_name, content)


def test_size_and_row_limits() -> None:
    too_big = b"Title\n" + b"x" * (5 * 1024 * 1024)
    too_many = ("Title\n" + "task\n" * (MAX_ROWS + 1)).encode()

    assert "larger than 5 MB" in _error("tasks.csv", too_big)
    assert "the limit is 2000" in _error("tasks.csv", too_many)


def test_the_messy_sample_file() -> None:
    parsed = read_table("messy_tasks.xlsx", SAMPLE.read_bytes())

    assert parsed.sheet_names == ["Tasks export", "Read me"]
    assert parsed.headers[:3] == ["Task Name", "Notes", "Owner"]
    assert len(parsed.rows) == 9  # two blank rows dropped

/**
 * Build a CSV that's safe to open in Excel or Google Sheets.
 *
 * Cells that start with = + - @ (or a tab or carriage return) can run as formulas
 * when opened ("CSV injection"), so they get a leading apostrophe, which makes the
 * spreadsheet treat them as text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
// Written as a char code so the invisible character never ends up in the source.
const BOM = String.fromCharCode(0xfeff);

export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: string[],
  rows: (string | null | undefined)[][],
): string {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/** Trigger a browser download of `text` as `fileName`. */
export function downloadCsv(fileName: string, text: string): void {
  // The BOM makes Excel read the file as UTF-8 (accents, peso signs and so on).
  const blob = new Blob([BOM, text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

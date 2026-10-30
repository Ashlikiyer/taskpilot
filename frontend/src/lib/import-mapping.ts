import type { Schemas } from "@/lib/api/client";

export type Mapping = Schemas["ImportMapping"];
export type Target = Mapping["columns"][string];

export const TARGETS: { value: Target; label: string }[] = [
  { value: "title", label: "Task title" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "due_date", label: "Due date" },
  { value: "labels", label: "Labels" },
  { value: "ignore", label: "Don't import" },
];

export const DATE_FORMATS: { value: string; label: string }[] = [
  { value: "", label: "Year first (2026-11-05)" },
  { value: "%m/%d/%Y", label: "Month first (11/05/2026 = Nov 5)" },
  { value: "%d/%m/%Y", label: "Day first (05/11/2026 = Nov 5)" },
  { value: "%d.%m.%Y", label: "Day first with dots (05.11.2026)" },
  { value: "%Y/%m/%d", label: "Year first with slashes (2026/11/05)" },
];

/** Every header mapped, defaulting to "Don't import". */
export function initialColumns(
  headers: string[],
  mapping: Mapping | null | undefined,
): Record<string, Target> {
  return Object.fromEntries(
    headers.map((header) => [header, mapping?.columns[header] ?? "ignore"]),
  );
}

/**
 * Map `header` to `target`. Each field (except "Don't import") belongs to one column,
 * so a column that already had this field goes back to "Don't import".
 */
export function assignTarget(
  columns: Record<string, Target>,
  header: string,
  target: Target,
): Record<string, Target> {
  const next: Record<string, Target> = {};
  for (const [name, current] of Object.entries(columns)) {
    next[name] = target !== "ignore" && current === target ? "ignore" : current;
  }
  next[header] = target;
  return next;
}

export function columnFor(
  columns: Record<string, Target>,
  target: Target,
): string | undefined {
  return Object.keys(columns).find((header) => columns[header] === target);
}

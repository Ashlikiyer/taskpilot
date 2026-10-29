import type { TaskPriority, TaskStatus } from "@/lib/tasks";

export type SortField = "title" | "status" | "priority" | "due_date";

/** List-view state. It lives in the URL so a filtered view can be shared or bookmarked. */
export type TaskFilters = {
  q: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  assignee: string | null;
  label: string | null;
  dueFrom: string | null;
  dueTo: string | null;
  sort: { field: SortField; desc: boolean } | null;
  page: number;
};

export const EMPTY_FILTERS: TaskFilters = {
  q: "",
  status: [],
  priority: [],
  assignee: null,
  label: null,
  dueFrom: null,
  dueTo: null,
  sort: null,
  page: 1,
};

const STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const SORT_FIELDS: SortField[] = ["title", "status", "priority", "due_date"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PAGE_SIZE = 25;

/** Read filters from the URL, ignoring anything malformed rather than failing. */
export function parseFilters(params: URLSearchParams): TaskFilters {
  const list = <T extends string>(key: string, allowed: T[]) =>
    (params.get(key) ?? "")
      .split(",")
      .filter((value): value is T => (allowed as string[]).includes(value));
  const date = (key: string) => {
    const value = params.get(key);
    return value && DATE.test(value) ? value : null;
  };
  const sortParam = params.get("sort") ?? "";
  const sortField = sortParam.replace(/^-/, "") as SortField;
  const page = Number(params.get("page"));

  return {
    q: params.get("q") ?? "",
    status: list("status", STATUSES),
    priority: list("priority", PRIORITIES),
    assignee: params.get("assignee"),
    label: params.get("label"),
    dueFrom: date("due_from"),
    dueTo: date("due_to"),
    sort: SORT_FIELDS.includes(sortField)
      ? { field: sortField, desc: sortParam.startsWith("-") }
      : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/**
 * Write filters back into the URL. Other params (like `?task=` for the open
 * drawer) are kept, and empty filters are removed so URLs stay short.
 */
export function writeFilters(
  current: URLSearchParams,
  filters: TaskFilters,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  const set = (key: string, value: string | null) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  set("q", filters.q.trim() || null);
  set("status", filters.status.join(",") || null);
  set("priority", filters.priority.join(",") || null);
  set("assignee", filters.assignee);
  set("label", filters.label);
  set("due_from", filters.dueFrom);
  set("due_to", filters.dueTo);
  set(
    "sort",
    filters.sort
      ? `${filters.sort.desc ? "-" : ""}${filters.sort.field}`
      : null,
  );
  set("page", filters.page > 1 ? String(filters.page) : null);
  return params;
}

/** The backend query string for GET /projects/{id}/tasks. */
export function toApiQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  filters.status.forEach((s) => params.append("status", s));
  filters.priority.forEach((p) => params.append("priority", p));
  if (filters.assignee) params.set("assignee_id", filters.assignee);
  if (filters.label) params.set("label", filters.label);
  if (filters.dueFrom) params.set("due_from", filters.dueFrom);
  if (filters.dueTo) params.set("due_to", filters.dueTo);
  params.set(
    "sort",
    filters.sort
      ? `${filters.sort.desc ? "-" : ""}${filters.sort.field}`
      : "position",
  );
  params.set("page", String(filters.page));
  params.set("page_size", String(PAGE_SIZE));
  return params.toString();
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return Boolean(
    filters.q.trim() ||
    filters.status.length ||
    filters.priority.length ||
    filters.assignee ||
    filters.label ||
    filters.dueFrom ||
    filters.dueTo,
  );
}

/** Header click cycles: ascending → descending → back to board order. */
export function nextSort(
  current: TaskFilters["sort"],
  field: SortField,
): TaskFilters["sort"] {
  if (current?.field !== field) return { field, desc: false };
  if (!current.desc) return { field, desc: true };
  return null;
}

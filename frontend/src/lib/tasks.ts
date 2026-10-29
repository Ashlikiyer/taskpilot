import type { Schemas } from "@/lib/api/client";
import { hasRole } from "@/lib/roles";

export type Task = Schemas["TaskOut"];
export type TaskStatus = Schemas["TaskStatus"];
export type TaskPriority = Schemas["TaskPriority"];
type Member = Schemas["MemberOut"];

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const STATUS_LABEL = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label]),
) as Record<TaskStatus, string>;

export const PRIORITY_LABEL = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.label]),
) as Record<TaskPriority, string>;

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  high: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  };
  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    groups[task.status].push(task);
  }
  return groups;
}

/**
 * Mirrors the backend rule (UI convenience only): admins edit any project's
 * tasks, members only in projects they belong to, and archived projects are read-only.
 */
export function canEditTasks(
  workspace: Schemas["WorkspaceOut"],
  project: Schemas["ProjectOut"],
  userId: string | undefined,
): boolean {
  if (project.archived_at !== null || !userId) return false;
  if (hasRole(workspace.role, "admin")) return true;
  return workspace.role === "member" && project.member_ids.includes(userId);
}

export function canDeleteTask(
  workspace: Schemas["WorkspaceOut"],
  task: Task,
  userId: string | undefined,
): boolean {
  return hasRole(workspace.role, "admin") || task.created_by === userId;
}

/** People who can be assigned: admins and owners, plus members on the project. */
export function assignableMembers(
  members: Member[],
  project: Schemas["ProjectOut"],
): Member[] {
  return members.filter(
    (m) =>
      hasRole(m.role, "admin") ||
      (m.role === "member" && project.member_ids.includes(m.user_id)),
  );
}

/** "Mon, Nov 3" style due date; dates are calendar days, so avoid timezone shifts. */
export function formatDueDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const FIELD_LABEL: Record<string, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  assignee_id: "assignee",
  due_date: "due date",
  labels: "labels",
};

/** One readable line per activity entry, e.g. "changed priority from Medium to High". */
export function describeActivity(
  entry: Schemas["ActivityOut"],
  memberNames: Record<string, string>,
): string {
  const show = (value: string | null): string => {
    if (value === null) return "none";
    if (entry.field === "status")
      return STATUS_LABEL[value as TaskStatus] ?? value;
    if (entry.field === "priority")
      return PRIORITY_LABEL[value as TaskPriority] ?? value;
    if (entry.field === "assignee_id")
      return memberNames[value] ?? "a former member";
    if (entry.field === "due_date") return formatDueDate(value);
    return `"${value}"`;
  };

  switch (entry.action) {
    case "created":
      return "created this task";
    case "deleted":
      return "deleted this task";
    case "reordered":
      return "reordered this task";
    case "updated": {
      const field = FIELD_LABEL[entry.field ?? ""] ?? entry.field ?? "a field";
      if (entry.field === "description") return "edited the description";
      if (entry.new_value === null) return `cleared the ${field}`;
      if (entry.old_value === null)
        return `set the ${field} to ${show(entry.new_value)}`;
      return `changed the ${field} from ${show(entry.old_value)} to ${show(entry.new_value)}`;
    }
    default:
      return entry.action;
  }
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

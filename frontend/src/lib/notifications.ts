import type { Schemas } from "@/lib/api/client";

type Notification = Schemas["NotificationOut"];

/** The fields the backend puts in every notification payload. */
type Payload = {
  task_title?: string;
  project_id?: string;
  workspace_slug?: string;
  actor_name?: string | null;
  excerpt?: string;
  // Digest notifications
  workspace_name?: string;
  overdue?: number;
  due_today?: number;
  at_risk?: number;
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function describeNotification(notification: Notification): {
  title: string;
  detail?: string;
} {
  const p = notification.payload as Payload;
  const actor = p.actor_name ?? "Someone";
  const task = p.task_title ?? "a task";
  switch (notification.type) {
    case "assigned":
      return { title: `${actor} assigned you "${task}"` };
    case "mentioned":
      return {
        title: `${actor} mentioned you on "${task}"`,
        detail: p.excerpt,
      };
    case "comment":
      return { title: `${actor} commented on "${task}"`, detail: p.excerpt };
    case "due_tomorrow":
      return { title: `"${task}" is due tomorrow` };
    case "digest": {
      const parts = [
        p.overdue ? `${p.overdue} overdue` : null,
        p.due_today ? `${p.due_today} due today` : null,
        p.at_risk ? `${plural(p.at_risk, "task")} at risk` : null,
      ].filter(Boolean);
      return {
        title: `Your daily digest for ${p.workspace_name ?? "your workspace"}`,
        detail: parts.join(" · "),
      };
    }
    default:
      return { title: task };
  }
}

/** Where a notification leads: the task's drawer on its board, or the digest page. */
export function notificationHref(notification: Notification): string | null {
  const p = notification.payload as Payload;
  if (notification.type === "digest" && p.workspace_slug) {
    return `/w/${p.workspace_slug}/digest`;
  }
  if (!p.workspace_slug || !p.project_id || !notification.task_id) return null;
  return `/w/${p.workspace_slug}/p/${p.project_id}?task=${notification.task_id}`;
}

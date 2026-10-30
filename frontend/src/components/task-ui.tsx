/** Small visual pieces shared by the board, lists, drawer, digest and dashboard. */
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_DOT_CLASS,
  STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function PriorityPill({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        PRIORITY_CLASS[priority],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusDot({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        STATUS_DOT_CLASS[status],
        className,
      )}
    />
  );
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// Soft background + dark ink pairs from the design, picked per person.
const AVATAR_COLORS = [
  "bg-[#e6e1fb] text-[#4a32b0]",
  "bg-[#fbe9e3] text-[#a84a2a]",
  "bg-[#e2ecfb] text-[#2a55b8]",
  "bg-[#e3f3ea] text-[#22744a]",
  "bg-[#fcefd9] text-[#8a5a10]",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function colorFor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  id,
  size = "md",
  className,
}: {
  name: string;
  /** Stable key for the color (user id); falls back to the name. */
  id?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-5 text-[8.5px]",
        size === "md" && "size-6 text-[9.5px]",
        size === "lg" && "size-8 text-[11px]",
        colorFor(id ?? name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** The ✦ mark the design uses for anything AI-made. */
export function Sparkle({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("text-ai", className)}>
      ✦
    </span>
  );
}

export function AIBadge({ label = "AI draft" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ai-soft px-1.5 py-0.5 text-[10.5px] font-medium text-ai">
      <span aria-hidden>✦</span>
      {label}
    </span>
  );
}

"use client";

import { CalendarIcon, SparklesIcon } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useDigestToday } from "@/hooks/use-ai";
import { useTaskParam } from "@/hooks/use-task-param";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";
import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

type DigestTask = Schemas["DigestTask"];

const GROUPS = [
  { key: "overdue", title: "Overdue", tone: "text-destructive" },
  { key: "due_today", title: "Due today", tone: "" },
  {
    key: "at_risk",
    title: "At risk",
    tone: "text-amber-700 dark:text-amber-400",
  },
] as const;

const REASON: Record<string, string> = {
  due_soon: "Due within 2 days and not started",
  stalled: "In progress, no activity for 5 days",
};

export default function DigestPage() {
  const { workspace } = useCurrentWorkspace();
  const isViewer = workspace?.role === "viewer";
  const digest = useDigestToday(isViewer ? undefined : workspace?.id);
  const [, openTask] = useTaskParam();
  if (!workspace) return null;

  const total = digest.data
    ? GROUPS.reduce(
        (sum, g) => sum + (digest.data.content[g.key] ?? []).length,
        0,
      )
    : 0;

  return (
    <div className="grid max-w-3xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Today&apos;s digest
        </h1>
        <p className="text-sm text-muted-foreground">
          {digest.data
            ? `${formatDueDate(digest.data.date)} · built every morning at 8:00 AM`
            : "Overdue, due today and at-risk tasks assigned to you."}
        </p>
      </header>

      {isViewer && (
        <EmptyState
          title="Viewers don't get a digest"
          description="The digest lists tasks assigned to you, and viewers can't be assigned tasks."
        />
      )}
      {digest.isPending && !isViewer && (
        <div className="grid gap-3" aria-busy>
          <Skeleton className="h-20" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {digest.isError && (
        <ErrorState
          message="We couldn't load your digest."
          onRetry={() => digest.refetch()}
        />
      )}

      {digest.data && total === 0 && (
        <EmptyState
          title="You're all caught up"
          description="Nothing assigned to you is overdue, due today or at risk."
        />
      )}

      {digest.data && total > 0 && (
        <>
          <DigestSummary summary={digest.data.summary} />
          {GROUPS.map(({ key, title, tone }) => (
            <DigestGroup
              key={key}
              title={title}
              tone={tone}
              tasks={digest.data.content[key] ?? []}
              onOpen={openTask}
            />
          ))}
          <p className="text-xs text-muted-foreground">
            This is a snapshot from when the digest was built. Open a task to
            see it as it is now.
          </p>
        </>
      )}
    </div>
  );
}

function DigestSummary({ summary }: { summary: string | null }) {
  if (!summary) return null; // the AI was unavailable; the lists below still stand
  return (
    <section
      aria-label="Summary"
      className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      <SparklesIcon
        className="mt-0.5 size-4 shrink-0 text-primary"
        aria-hidden
      />
      <p className="text-sm leading-relaxed">{summary}</p>
    </section>
  );
}

function DigestGroup({
  title,
  tone,
  tasks,
  onOpen,
}: {
  title: string;
  tone: string;
  tasks: DigestTask[];
  onOpen: (taskId: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section
      aria-label={`${title}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
    >
      <h2
        className={cn(
          "mb-1 flex items-center gap-2 px-3 text-sm font-medium",
          tone,
        )}
      >
        {title}
        <span className="text-muted-foreground">{tasks.length}</span>
      </h2>
      <ul className="grid divide-y rounded-xl border">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onOpen(task.id)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate text-sm">{task.title}</span>
                {task.reason && (
                  <span className="block text-xs text-muted-foreground">
                    {REASON[task.reason]}
                  </span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="max-w-36 truncate">{task.project_name}</span>
                <span>
                  {STATUS_LABEL[task.status as TaskStatus] ?? task.status}
                </span>
                {task.due_date && (
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="size-3.5" aria-hidden />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    PRIORITY_CLASS[task.priority as TaskPriority],
                  )}
                >
                  {PRIORITY_LABEL[task.priority as TaskPriority] ??
                    task.priority}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

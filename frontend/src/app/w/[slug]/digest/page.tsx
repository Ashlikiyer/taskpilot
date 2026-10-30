"use client";

import { EmptyState, ErrorState } from "@/components/states";
import { PriorityPill } from "@/components/task-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useDigestToday } from "@/hooks/use-ai";
import { useMe } from "@/hooks/use-auth";
import { useTaskParam } from "@/hooks/use-task-param";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";
import {
  formatDueDate,
  STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

type DigestTask = Schemas["DigestTask"];

const GROUPS = [
  { key: "overdue", title: "Overdue", dot: "bg-[#d9443a]" },
  { key: "due_today", title: "Due today", dot: "bg-foreground" },
  { key: "at_risk", title: "At risk", dot: "bg-status-in-review" },
] as const;

const REASON: Record<string, string> = {
  due_soon: "Due within 2 days and not started",
  stalled: "In progress, no activity for 5 days",
};

function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DigestPage() {
  const { workspace } = useCurrentWorkspace();
  const isViewer = workspace?.role === "viewer";
  const digest = useDigestToday(isViewer ? undefined : workspace?.id);
  const me = useMe();
  const [, openTask] = useTaskParam();
  if (!workspace) return null;

  const total = digest.data
    ? GROUPS.reduce(
        (sum, g) => sum + (digest.data.content[g.key] ?? []).length,
        0,
      )
    : 0;

  return (
    <div className="grid max-w-[1100px] gap-6">
      <header className="grid gap-1.5">
        <p className="font-mono text-xs text-subtle uppercase">
          {digest.data
            ? `${formatDueDate(digest.data.date).replace(",", " ·")} · 8:00 AM`
            : "Today's digest"}
        </p>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">
          {greeting()}
          {me.data?.name ? `, ${me.data.name.split(" ")[0]}` : ""}
        </h1>
        <p className="sr-only">
          Your daily digest: overdue, due today and at-risk tasks assigned to
          you, built every morning at 8:00 AM.
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
          <div className="grid gap-4 md:grid-cols-3">
            {GROUPS.map(({ key, title, dot }) => (
              <DigestGroup
                key={key}
                title={title}
                dot={dot}
                tasks={digest.data.content[key] ?? []}
                onOpen={openTask}
              />
            ))}
          </div>
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
      className="grid gap-2.5 rounded-xl border border-ai-border bg-[#f7f5fe] px-[22px] py-5"
    >
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.04em] text-ai">
        <span aria-hidden>✦</span>AI SUMMARY
      </p>
      <p className="text-[17px] leading-relaxed text-pretty text-ai-ink">
        {summary}
      </p>
      <p className="text-[11.5px] text-ai-muted">
        The task lists below come from your data. The AI writes only this
        paragraph.
      </p>
    </section>
  );
}

function DigestGroup({
  title,
  dot,
  tasks,
  onOpen,
}: {
  title: string;
  dot: string;
  tasks: DigestTask[];
  onOpen: (taskId: string) => void;
}) {
  return (
    <section
      aria-label={`${title}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      className="flex flex-col overflow-hidden rounded-xl border bg-card"
    >
      <h2 className="flex items-center gap-2 border-b border-[#f0f0ec] px-4 py-3.5 text-sm font-semibold">
        <span aria-hidden className={cn("size-2 rounded-full", dot)} />
        {title}
        <span className="ml-auto font-mono text-xs font-normal text-subtle">
          {tasks.length}
        </span>
      </h2>
      {tasks.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-subtle">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-[#f4f4f1]">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task.id)}
                className="grid w-full gap-1 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex items-start gap-2">
                  <span className="flex-1 text-[13.5px] font-medium">
                    {task.title}
                  </span>
                  <PriorityPill priority={task.priority as TaskPriority} />
                </span>
                <span className="text-xs text-[#77777c]">
                  {task.project_name}
                  {" · "}
                  {task.reason
                    ? REASON[task.reason]
                    : task.due_date
                      ? `due ${formatDueDate(task.due_date)}`
                      : (STATUS_LABEL[task.status as TaskStatus] ??
                        task.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { EmptyState, ErrorState } from "@/components/states";
import { TASK_ROW_COLUMNS, TaskRow } from "@/components/tasks/task-row";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { useTaskParam } from "@/hooks/use-task-param";
import { useMyTasks } from "@/hooks/use-tasks";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";
import { type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const GROUPS = [
  { key: "overdue", title: "Overdue", tone: "text-overdue" },
  { key: "due_today", title: "Today", tone: "" },
  { key: "this_week", title: "This week", tone: "" },
  { key: "later", title: "Later", tone: "" },
  { key: "no_date", title: "No date", tone: "text-[#77777c]" },
] as const;

export default function MyTasksPage() {
  const { workspace } = useCurrentWorkspace();
  const isViewer = workspace?.role === "viewer";
  const myTasks = useMyTasks(isViewer ? undefined : workspace?.id);
  const projects = useProjects(workspace?.id);
  const [, openTask] = useTaskParam();
  if (!workspace) return null;

  const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const all = myTasks.data ? GROUPS.flatMap((g) => myTasks.data[g.key]) : [];
  const total = all.length;
  const projectCount = new Set(all.map((t) => t.project_id)).size;
  const today = myTasks.data
    ? new Date(`${myTasks.data.today}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">My Tasks</h1>
        <p className="text-[13px] text-muted-foreground">
          {myTasks.data
            ? `${total} open across ${projectCount} ${projectCount === 1 ? "project" : "projects"} · ${today}`
            : "Open tasks assigned to you across this workspace's projects."}
        </p>
      </header>

      {isViewer && (
        <EmptyState
          title="Viewers don't have assigned tasks"
          description="Ask an admin to change your role if you need to work on tasks."
        />
      )}
      {myTasks.isPending && !isViewer && (
        <div className="grid gap-2" aria-busy>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {myTasks.isError && (
        <ErrorState
          message="We couldn't load your tasks."
          onRetry={() => myTasks.refetch()}
        />
      )}
      {myTasks.data && total === 0 && (
        <EmptyState
          title="You're all caught up"
          description="Nothing open is assigned to you. Tasks assigned to you will show up here."
        />
      )}
      {myTasks.data && total > 0 && (
        <div className="-mx-4 overflow-hidden border-y bg-card pb-2 md:mx-0 md:rounded-xl md:border">
          <div
            aria-hidden
            className={cn(
              "hidden border-b px-8 py-2 text-[11.5px] tracking-[0.02em] text-subtle",
              TASK_ROW_COLUMNS,
            )}
          >
            <span />
            <span>Task</span>
            <span>Project</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Due</span>
          </div>
          {GROUPS.map(({ key, title, tone }) => (
            <TaskGroup
              key={key}
              title={title}
              tone={tone}
              tasks={myTasks.data[key]}
              projectById={projectById}
              onOpen={openTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tone,
  tasks,
  projectById,
  onOpen,
}: {
  title: string;
  tone: string;
  tasks: Task[];
  projectById: Map<string, Schemas["ProjectOut"]>;
  onOpen: (taskId: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section
      aria-label={`${title}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
    >
      <h2
        className={cn(
          "flex items-center gap-2 px-[18px] pt-3 pb-1.5 text-[12.5px] font-semibold md:px-8",
          tone,
        )}
      >
        {title}
        <span className="font-mono text-[11px] font-normal text-subtle">
          {tasks.length}
        </span>
      </h2>
      <ul className="grid divide-y divide-[#f2f2ef] border-b border-[#f2f2ef]">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskRow
              task={task}
              project={projectById.get(task.project_id)}
              onOpen={() => onOpen(task.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

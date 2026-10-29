"use client";

import { EmptyState, ErrorState } from "@/components/states";
import { TaskRow } from "@/components/tasks/task-row";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { useTaskParam } from "@/hooks/use-task-param";
import { useMyTasks } from "@/hooks/use-tasks";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";
import { formatDueDate, type Task } from "@/lib/tasks";

const GROUPS = [
  { key: "overdue", title: "Overdue", tone: "text-destructive" },
  { key: "due_today", title: "Today", tone: "" },
  { key: "this_week", title: "This week", tone: "" },
  { key: "later", title: "Later", tone: "" },
  { key: "no_date", title: "No date", tone: "" },
] as const;

export default function MyTasksPage() {
  const { workspace } = useCurrentWorkspace();
  const isViewer = workspace?.role === "viewer";
  const myTasks = useMyTasks(isViewer ? undefined : workspace?.id);
  const projects = useProjects(workspace?.id);
  const [, openTask] = useTaskParam();
  if (!workspace) return null;

  const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
  const total = myTasks.data
    ? GROUPS.reduce((sum, g) => sum + myTasks.data[g.key].length, 0)
    : 0;

  return (
    <div className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {myTasks.data
            ? `Open tasks assigned to you · today is ${formatDueDate(myTasks.data.today)}`
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
      {myTasks.data &&
        total > 0 &&
        GROUPS.map(({ key, title, tone }) => (
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
        className={`mb-1 flex items-center gap-2 px-3 text-sm font-medium ${tone}`}
      >
        {title}
        <span className="text-muted-foreground">{tasks.length}</span>
      </h2>
      <ul className="grid divide-y rounded-xl border">
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

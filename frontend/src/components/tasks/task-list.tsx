"use client";

import { AddTaskInput } from "@/components/tasks/add-task-input";
import { TaskRow } from "@/components/tasks/task-row";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskParam } from "@/hooks/use-task-param";
import { useProjectTasks } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspaces";
import type { Schemas } from "@/lib/api/client";
import { groupByStatus, STATUSES } from "@/lib/tasks";

export function TaskList({
  workspace,
  project,
  canEdit,
}: {
  workspace: Schemas["WorkspaceOut"];
  project: Schemas["ProjectOut"];
  canEdit: boolean;
}) {
  const tasks = useProjectTasks(project.id);
  const members = useMembers(workspace.id);
  const [, openTask] = useTaskParam();
  const names = Object.fromEntries(
    (members.data ?? []).map((m) => [m.user_id, m.name]),
  );

  return (
    <section aria-labelledby="tasks-heading" className="grid gap-4">
      <h2 id="tasks-heading" className="sr-only">
        Tasks
      </h2>
      {canEdit && <AddTaskInput projectId={project.id} />}

      {tasks.isPending && (
        <div className="grid gap-2" aria-busy>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
      {tasks.isError && (
        <ErrorState
          message="We couldn't load tasks."
          onRetry={() => tasks.refetch()}
        />
      )}
      {tasks.data?.items.length === 0 && (
        <EmptyState
          title="No tasks yet"
          description={
            canEdit
              ? "Add the first task above. Press Enter to save it."
              : "Tasks added by the team will show up here."
          }
        />
      )}
      {tasks.data && tasks.data.items.length > 0 && (
        <div className="grid gap-6">
          {Object.entries(groupByStatus(tasks.data.items)).map(
            ([status, items]) => (
              <section
                key={status}
                aria-label={STATUSES.find((s) => s.value === status)?.label}
              >
                <h3 className="mb-1 flex items-center gap-2 px-3 text-sm font-medium">
                  {STATUSES.find((s) => s.value === status)?.label}
                  <span className="text-muted-foreground">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="px-3 text-sm text-muted-foreground">
                    Nothing here.
                  </p>
                ) : (
                  <ul className="grid divide-y rounded-xl border">
                    {items.map((task) => (
                      <li key={task.id}>
                        <TaskRow
                          task={task}
                          assigneeName={
                            task.assignee_id
                              ? names[task.assignee_id]
                              : undefined
                          }
                          onOpen={() => openTask(task.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ),
          )}
        </div>
      )}
    </section>
  );
}

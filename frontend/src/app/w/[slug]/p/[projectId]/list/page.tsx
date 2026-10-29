"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState, ErrorState } from "@/components/states";
import { FilterBar } from "@/components/tasks/filter-bar";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-projects";
import { useTaskParam } from "@/hooks/use-task-param";
import { useLabels, useTaskListPage } from "@/hooks/use-tasks";
import { useCurrentWorkspace, useMembers } from "@/hooks/use-workspaces";
import {
  hasActiveFilters,
  PAGE_SIZE,
  parseFilters,
  type TaskFilters,
  toApiQuery,
  writeFilters,
} from "@/lib/task-filters";
import { assignableMembers, canEditTasks } from "@/lib/tasks";

export default function ProjectListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspace } = useCurrentWorkspace();
  const project = useCurrentProject();
  const me = useMe();
  const members = useMembers(workspace?.id);
  const labels = useLabels(workspace?.id);
  const [, openTask] = useTaskParam();

  const filters = parseFilters(searchParams);
  const tasks = useTaskListPage(project.data?.id ?? "", toApiQuery(filters));
  // The project layout handles loading, error and not-found states for the project.
  if (!workspace || !project.data) return null;

  const setFilters = (next: TaskFilters) => {
    const query = writeFilters(searchParams, next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };
  const canEdit = canEditTasks(workspace, project.data, me.data?.id);
  const memberNames = Object.fromEntries(
    (members.data ?? []).map((m) => [m.user_id, m.name]),
  );
  const pageCount = tasks.data
    ? Math.max(1, Math.ceil(tasks.data.total / PAGE_SIZE))
    : 1;

  return (
    <div className="grid gap-4">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        members={members.data ?? []}
        labels={labels.data ?? []}
      />

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
          title={
            hasActiveFilters(filters) ? "No matching tasks" : "No tasks yet"
          }
          description={
            hasActiveFilters(filters)
              ? "Try a different search or clear some filters."
              : "Tasks added on the board will show up here."
          }
        />
      )}
      {tasks.data && tasks.data.items.length > 0 && (
        <>
          <TaskTable
            tasks={tasks.data.items}
            sort={filters.sort}
            onSortChange={(sort) => setFilters({ ...filters, sort, page: 1 })}
            canEdit={canEdit}
            assignees={assignableMembers(members.data ?? [], project.data)}
            memberNames={memberNames}
            onOpen={openTask}
          />
          <nav
            aria-label="Pages"
            className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"
          >
            <span aria-live="polite">
              {tasks.data.total} {tasks.data.total === 1 ? "task" : "tasks"} ·
              page {filters.page} of {pageCount}
            </span>
            {pageCount > 1 && (
              <span className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page - 1 })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= pageCount}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page + 1 })
                  }
                >
                  Next
                </Button>
              </span>
            )}
          </nav>
        </>
      )}
    </div>
  );
}

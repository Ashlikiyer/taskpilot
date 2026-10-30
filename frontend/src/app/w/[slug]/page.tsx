"use client";

import Link from "next/link";
import { useState } from "react";

import {
  CompletedPerWeekChart,
  OpenByStatus,
  StatCards,
  WorkloadChart,
} from "@/components/dashboard/dashboard-charts";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard";
import { useProjects } from "@/hooks/use-projects";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import { hasRole } from "@/lib/roles";

const ALL = "all";

export default function WorkspaceDashboardPage() {
  const { workspace } = useCurrentWorkspace();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const projects = useProjects(workspace?.id, {
    includeArchived: showArchived,
  });
  const activeProjects = useProjects(workspace?.id);
  const dashboard = useDashboard(workspace?.id, projectId);
  if (!workspace) return null;

  const canCreate = hasRole(workspace.role, "admin");
  const projectItems = [
    { value: ALL, label: "All projects" },
    ...(activeProjects.data ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="grid max-w-[1100px] gap-[18px]">
      <header className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 gap-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Dashboard
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {workspace.name} · last 8 weeks
          </p>
        </div>
        <Select
          items={projectItems}
          value={projectId ?? ALL}
          onValueChange={(value) =>
            setProjectId(!value || value === ALL ? null : value)
          }
        >
          <SelectTrigger
            size="sm"
            className="w-44"
            aria-label="Show numbers for"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {dashboard.isPending && (
        <div className="grid gap-3" aria-busy>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      )}
      {dashboard.isError && (
        <ErrorState
          message="We couldn't load the dashboard."
          onRetry={() => dashboard.refetch()}
        />
      )}
      {dashboard.data && (
        <>
          <StatCards data={dashboard.data} />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CompletedPerWeekChart weeks={dashboard.data.completed_per_week} />
            <div className="flex flex-col gap-3">
              <OpenByStatus counts={dashboard.data.open_by_status} />
              <WorkloadChart members={dashboard.data.workload} />
            </div>
          </div>
        </>
      )}

      <section aria-labelledby="projects-heading" className="mt-4 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="projects-heading" className="text-lg font-semibold">
            Projects
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-archived"
                aria-labelledby="show-archived-label"
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked)}
              />
              <Label
                id="show-archived-label"
                htmlFor="show-archived"
                className="font-normal"
              >
                Show archived
              </Label>
            </div>
            {canCreate && (
              <Button onClick={() => setCreating(true)}>New project</Button>
            )}
          </div>
        </div>

        {projects.isPending && (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}
        {projects.isError && (
          <ErrorState
            message="We couldn't load projects."
            onRetry={() => projects.refetch()}
          />
        )}
        {projects.data?.length === 0 && (
          <EmptyState
            title={showArchived ? "No projects" : "No active projects"}
            description={
              canCreate
                ? "Create a project to start organizing your team's tasks."
                : "An admin can create projects for this workspace."
            }
          />
        )}
        {projects.data && projects.data.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.data.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/w/${workspace.slug}/p/${project.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate font-medium">{project.name}</span>
                    {project.archived_at && (
                      <Badge variant="secondary" className="ml-auto">
                        Archived
                      </Badge>
                    )}
                  </span>
                  {project.description && (
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </span>
                  )}
                  <span className="mt-auto text-xs text-muted-foreground">
                    {project.member_ids.length}{" "}
                    {project.member_ids.length === 1 ? "member" : "members"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCreate && (
        <ProjectFormDialog
          workspace={workspace}
          open={creating}
          onOpenChange={setCreating}
        />
      )}
    </div>
  );
}

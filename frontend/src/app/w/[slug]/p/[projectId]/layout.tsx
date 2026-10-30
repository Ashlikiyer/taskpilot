"use client";

import { InboxIcon, KanbanIcon, ListIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ProjectHeader } from "@/components/projects/project-header";
import { EmptyState, ErrorState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/hooks/use-projects";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import { ApiError } from "@/lib/api/client";
import { hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = useCurrentWorkspace();
  const project = useCurrentProject();
  const pathname = usePathname();
  if (!workspace) return null;

  const notFound =
    (project.error instanceof ApiError && project.error.status === 404) ||
    (project.data && project.data.workspace_id !== workspace.id);

  if (notFound) {
    return (
      <EmptyState
        title="Project not found"
        description="It may have been deleted, or it belongs to another workspace."
        action={
          <Link href={`/w/${workspace.slug}`} className={buttonVariants()}>
            Back to dashboard
          </Link>
        }
      />
    );
  }
  if (project.isError) {
    return (
      <ErrorState
        message="We couldn't load this project."
        onRetry={() => project.refetch()}
      />
    );
  }
  if (!project.data) {
    return (
      <div className="grid max-w-4xl gap-3" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
    );
  }

  const base = `/w/${workspace.slug}/p/${project.data.id}`;
  const tabs = [
    { href: base, label: "Board", icon: KanbanIcon, count: 0 },
    { href: `${base}/list`, label: "List", icon: ListIcon, count: 0 },
    ...(hasRole(workspace.role, "admin")
      ? [
          {
            href: `${base}/inbox`,
            label: "Inbox",
            icon: InboxIcon,
            count: project.data.intake_pending,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-6">
      <ProjectHeader workspace={workspace} project={project.data} />
      <nav aria-label="Project views" className="flex gap-1 border-b">
        {tabs.map(({ href, label, icon: Icon, count }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent",
              )}
            >
              <Icon className="size-4" />
              {label}
              {count > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {count}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

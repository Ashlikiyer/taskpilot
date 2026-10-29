"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ProjectHeader } from "@/components/projects/project-header";
import { EmptyState, ErrorState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-projects";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import { ApiError } from "@/lib/api/client";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { workspace } = useCurrentWorkspace();
  const project = useProject(projectId);
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

  return (
    <div className="grid max-w-5xl gap-8">
      <ProjectHeader workspace={workspace} project={project.data} />
      <EmptyState
        title="No tasks yet"
        description="The task board for this project is coming next."
      />
    </div>
  );
}

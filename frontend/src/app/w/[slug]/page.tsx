"use client";

import { EmptyState } from "@/components/states";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";

export default function WorkspaceDashboardPage() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;

  return (
    <div className="grid max-w-4xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {workspace.name}
      </h1>
      <EmptyState
        title="No projects yet"
        description="Projects, tasks and your team dashboard will appear here."
      />
    </div>
  );
}

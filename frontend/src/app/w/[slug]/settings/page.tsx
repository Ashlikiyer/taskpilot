"use client";

import { useState } from "react";
import { toast } from "sonner";

import { IntakeSettingsRow } from "@/components/intake/intake-settings-row";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import {
  useCurrentWorkspace,
  useRenameWorkspace,
} from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { hasRole } from "@/lib/roles";

export default function WorkspaceSettingsPage() {
  const { workspace } = useCurrentWorkspace();
  const isAdmin = hasRole(workspace?.role, "admin");
  const projects = useProjects(isAdmin ? workspace?.id : undefined);
  if (!workspace) return null;

  if (!isAdmin) {
    return (
      <EmptyState
        title="Only admins can change workspace settings"
        description="Ask an admin or the owner if something here needs changing."
      />
    );
  }

  return (
    <div className="grid max-w-3xl gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Workspace settings
      </h1>

      <GeneralForm key={workspace.name} workspace={workspace} />

      <section aria-labelledby="intake-heading" className="grid gap-3">
        <div>
          <h2 id="intake-heading" className="text-lg font-semibold">
            Email and form intake
          </h2>
          <p className="text-sm text-muted-foreground">
            Turn emails and public form submissions into task proposals in each
            project&apos;s Inbox. Setting up Gmail also needs the TaskPilot Apps
            Script (see the README).
          </p>
        </div>
        {projects.isPending && <Skeleton className="h-40" aria-busy />}
        {projects.isError && (
          <ErrorState
            message="We couldn't load projects."
            onRetry={() => projects.refetch()}
          />
        )}
        {projects.data?.length === 0 && (
          <EmptyState
            title="No active projects"
            description="Create a project first, then connect intake to it."
          />
        )}
        {projects.data && projects.data.length > 0 && (
          <ul className="grid gap-3">
            {projects.data.map((project) => (
              <IntakeSettingsRow key={project.id} project={project} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GeneralForm({ workspace }: { workspace: Schemas["WorkspaceOut"] }) {
  const rename = useRenameWorkspace(workspace.id);
  const [name, setName] = useState(workspace.name);
  const changed = name.trim() && name.trim() !== workspace.name;

  return (
    <section aria-labelledby="general-heading" className="grid gap-3">
      <h2 id="general-heading" className="text-lg font-semibold">
        General
      </h2>
      <form
        className="grid max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!changed) return;
          rename.mutate(name.trim(), {
            onSuccess: () => toast.success("Workspace renamed"),
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      >
        <Label htmlFor="workspace-name">Workspace name</Label>
        <div className="flex gap-2">
          <Input
            id="workspace-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={!changed || rename.isPending}>
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The workspace address (/w/{workspace.slug}) stays the same.
        </p>
      </form>
    </section>
  );
}

"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSetProjectArchived } from "@/hooks/use-projects";
import { useMembers } from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { hasRole } from "@/lib/roles";

export function ProjectHeader({
  workspace,
  project,
}: {
  workspace: Schemas["WorkspaceOut"];
  project: Schemas["ProjectOut"];
}) {
  const [editing, setEditing] = useState(false);
  const setArchived = useSetProjectArchived(project.id);
  const members = useMembers(workspace.id);
  const canManage = hasRole(workspace.role, "admin");
  const archived = project.archived_at !== null;

  const memberNames = (members.data ?? [])
    .filter((m) => project.member_ids.includes(m.user_id))
    .map((m) => m.name);

  const toggleArchived = (next: boolean) =>
    setArchived.mutate(next, {
      onSuccess: () =>
        toast.success(
          next ? `${project.name} archived` : `${project.name} restored`,
          {
            action: next
              ? { label: "Undo", onClick: () => setArchived.mutate(false) }
              : undefined,
          },
        ),
      onError: (error) => toast.error(errorMessage(error)),
    });

  return (
    <header className="grid gap-4">
      {archived && (
        <Alert>
          <AlertDescription>
            This project is archived. It&apos;s hidden from the sidebar
            {canManage ? " until you restore it." : "."}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="mt-2 size-3 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              <span className="break-words">{project.name}</span>
              {archived && <Badge variant="secondary">Archived</Badge>}
            </h1>
            {project.description && (
              <p className="mt-1 max-w-2xl whitespace-pre-line text-muted-foreground">
                {project.description}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {memberNames.length > 0
                ? `Members: ${memberNames.join(", ")}`
                : "No members yet"}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
            <Button
              variant="outline"
              disabled={setArchived.isPending}
              onClick={() => toggleArchived(!archived)}
            >
              {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {archived ? "Restore" : "Archive"}
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <ProjectFormDialog
          workspace={workspace}
          project={project}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </header>
  );
}

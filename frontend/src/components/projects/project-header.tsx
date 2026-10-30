"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar } from "@/components/task-ui";
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

  const projectMembers = (members.data ?? []).filter((m) =>
    project.member_ids.includes(m.user_id),
  );

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
    <header className="grid gap-3">
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
            className="mt-[7px] h-[11px] w-3.5 shrink-0 rounded-[2px_3px_3px_3px]"
            style={{ backgroundColor: project.color }}
          />
          <div className="grid min-w-0 gap-0.5">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-[-0.015em]">
              <span className="break-words">{project.name}</span>
              {archived && <Badge variant="secondary">Archived</Badge>}
            </h1>
            <p className="text-[12.5px] text-subtle">
              {projectMembers.length === 1
                ? "1 member"
                : `${projectMembers.length} members`}
              {project.description && (
                <span className="whitespace-pre-line">
                  {" "}
                  · {project.description}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {projectMembers.length > 0 && (
            <ul
              aria-label={`Members: ${projectMembers.map((m) => m.name).join(", ")}`}
              className="flex pl-[7px]"
            >
              {projectMembers.slice(0, 6).map((m) => (
                <li key={m.user_id} className="-ml-[7px]">
                  <Avatar
                    name={m.name}
                    id={m.user_id}
                    className="border-2 border-background"
                  />
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <PencilIcon />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={setArchived.isPending}
                onClick={() => toggleArchived(!archived)}
              >
                {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                {archived ? "Restore" : "Archive"}
              </Button>
            </div>
          )}
        </div>
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

"use client";

import { TaskBoard } from "@/components/board/task-board";
import { AddTaskInput } from "@/components/tasks/add-task-input";
import { useMe } from "@/hooks/use-auth";
import { useCurrentProject } from "@/hooks/use-projects";
import { useCurrentWorkspace } from "@/hooks/use-workspaces";
import { canEditTasks } from "@/lib/tasks";

export default function ProjectBoardPage() {
  const { workspace } = useCurrentWorkspace();
  const project = useCurrentProject();
  const me = useMe();
  // The project layout handles loading, error and not-found states.
  if (!workspace || !project.data) return null;

  const canEdit = canEditTasks(workspace, project.data, me.data?.id);

  return (
    <div className="grid gap-4">
      {canEdit && (
        <div className="max-w-xl">
          <AddTaskInput projectId={project.data.id} />
        </div>
      )}
      <TaskBoard
        workspace={workspace}
        project={project.data}
        canEdit={canEdit}
      />
    </div>
  );
}

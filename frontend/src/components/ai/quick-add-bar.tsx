"use client";

import { PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QuickAddPreview } from "@/components/ai/quick-add-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/use-auth";
import { useQuickAdd } from "@/hooks/use-ai";
import { useProjects } from "@/hooks/use-projects";
import { useCreateTask, useCreateTaskIn, useLabels } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspaces";
import { ApiError, errorMessage, type Schemas } from "@/lib/api/client";
import { canEditTasks } from "@/lib/tasks";

/**
 * Type a task title and press Enter to add it as written, or describe it in a
 * sentence ("Ask Mark to send the Acme invoice by Friday, high priority") and use
 * "Create with AI" to review an AI draft first.
 */
export function QuickAddBar({
  workspace,
  project,
}: {
  workspace: Schemas["WorkspaceOut"];
  project: Schemas["ProjectOut"];
}) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Schemas["QuickAddDraft"] | null>(null);
  const me = useMe();
  const projects = useProjects(workspace.id);
  const members = useMembers(workspace.id);
  const labels = useLabels(workspace.id);
  const quickAdd = useQuickAdd(workspace.id);
  const createTask = useCreateTask(project.id);
  const createTaskIn = useCreateTaskIn();

  const usableProjects = (projects.data ?? []).filter((p) =>
    canEditTasks(workspace, p, me.data?.id),
  );
  const busy = quickAdd.isPending || createTask.isPending;

  const addAsWritten = (event: React.FormEvent) => {
    event.preventDefault();
    const title = text.trim();
    if (!title) return;
    createTask.mutate(
      { title },
      {
        onSuccess: () => setText(""),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const askAI = () => {
    const sentence = text.trim();
    if (!sentence) return;
    quickAdd.mutate(
      { text: sentence, default_project_id: project.id },
      {
        onSuccess: setDraft,
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.code === "AI_DAILY_LIMIT"
              ? error.message
              : `The AI couldn't draft this task. ${errorMessage(error)}`,
          ),
      },
    );
  };

  return (
    <>
      <form onSubmit={addAsWritten} className="flex flex-wrap gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Add a task, or describe it: "Ask Mark to send the invoice by Friday"'
          aria-label="New task"
          maxLength={500}
          disabled={busy}
          className="min-w-0 flex-1 basis-64"
        />
        <Button type="submit" variant="outline" disabled={!text.trim() || busy}>
          <PlusIcon />
          Add
        </Button>
        <Button type="button" onClick={askAI} disabled={!text.trim() || busy}>
          <SparklesIcon />
          {quickAdd.isPending ? "Drafting…" : "Create with AI"}
        </Button>
      </form>

      <QuickAddPreview
        draft={draft}
        projects={usableProjects}
        members={members.data ?? []}
        labels={labels.data ?? []}
        saving={createTaskIn.isPending}
        error={
          createTaskIn.isError ? errorMessage(createTaskIn.error) : undefined
        }
        onCancel={() => {
          setDraft(null);
          createTaskIn.reset();
        }}
        onConfirm={({ projectId, task }) =>
          createTaskIn.mutate(
            { projectId, data: task },
            {
              onSuccess: () => {
                const where = usableProjects.find(
                  (p) => p.id === projectId,
                )?.name;
                toast.success(
                  projectId === project.id
                    ? "Task created"
                    : `Task created in ${where}`,
                );
                setDraft(null);
                setText("");
              },
            },
          )
        }
      />
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { QuickAddPreview } from "@/components/ai/quick-add-preview";
import { Sparkle } from "@/components/task-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMe } from "@/hooks/use-auth";
import { useAIUsage, useQuickAdd } from "@/hooks/use-ai";
import { useProjects } from "@/hooks/use-projects";
import { useCreateTaskIn, useLabels } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspaces";
import { ApiError, errorMessage, type Schemas } from "@/lib/api/client";
import { canEditTasks } from "@/lib/tasks";

type Workspace = Schemas["WorkspaceOut"];

const CreateWithAIContext = createContext<{
  open: () => void;
  available: boolean;
}>({ open: () => {}, available: false });

/** Open the global "Create with AI" dialog (sidebar button, mobile tab bar). */
export function useCreateWithAI() {
  return useContext(CreateWithAIContext);
}

export function usageNote(usage: Schemas["AIUsageOut"] | undefined) {
  return usage
    ? `${usage.used} of ${usage.limit} AI calls used today`
    : undefined;
}

/**
 * Describe a task in a sentence from anywhere in the workspace (Ctrl/Cmd+J), then
 * review the AI's draft. Viewers can't create tasks, so it's off for them.
 */
export function CreateWithAIProvider({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: React.ReactNode;
}) {
  const available = workspace.role !== "viewer";
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!available) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "j" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setAsking(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [available]);

  return (
    <CreateWithAIContext.Provider
      value={{ open: () => setAsking(true), available }}
    >
      {children}
      {available && (
        <CreateWithAIFlow
          workspace={workspace}
          asking={asking}
          onAskingChange={setAsking}
        />
      )}
    </CreateWithAIContext.Provider>
  );
}

function CreateWithAIFlow({
  workspace,
  asking,
  onAskingChange,
}: {
  workspace: Workspace;
  asking: boolean;
  onAskingChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Schemas["QuickAddDraft"] | null>(null);
  const me = useMe();
  const usage = useAIUsage();
  const projects = useProjects(workspace.id);
  const members = useMembers(workspace.id);
  const labels = useLabels(workspace.id);
  const quickAdd = useQuickAdd(workspace.id);
  const createTaskIn = useCreateTaskIn();

  const usableProjects = (projects.data ?? []).filter((p) =>
    canEditTasks(workspace, p, me.data?.id),
  );
  // On a project page, that project is the default when the sentence names none.
  const currentProjectId = pathname.match(/\/p\/([^/?]+)/)?.[1];
  const defaultProject = usableProjects.find((p) => p.id === currentProjectId);

  const ask = (event: React.FormEvent) => {
    event.preventDefault();
    const sentence = text.trim();
    if (!sentence) return;
    quickAdd.mutate(
      { text: sentence, default_project_id: defaultProject?.id ?? null },
      {
        onSuccess: (result) => {
          onAskingChange(false);
          setDraft(result);
        },
      },
    );
  };

  const failure = quickAdd.isError
    ? quickAdd.error instanceof ApiError &&
      quickAdd.error.code === "AI_DAILY_LIMIT"
      ? quickAdd.error.message
      : `The AI couldn't draft this task. ${errorMessage(quickAdd.error)}`
    : undefined;

  return (
    <>
      <Dialog
        open={asking}
        onOpenChange={(open) => {
          onAskingChange(open);
          if (!open) quickAdd.reset();
        }}
      >
        <DialogContent
          className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[620px] max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none"
          showCloseButton={false}
        >
          <form onSubmit={ask}>
            <DialogTitle className="sr-only">Create a task with AI</DialogTitle>
            <DialogDescription className="sr-only">
              Describe the task in a sentence. The AI drafts it and you review
              it before anything is saved.
            </DialogDescription>
            <div className="flex items-start gap-2.5 border-b px-4 py-3.5">
              <Sparkle className="mt-1.5 text-base" />
              <textarea
                autoFocus
                rows={2}
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                aria-label="Describe the task"
                placeholder="Ask Mark to send the Acme invoice by Friday, high priority"
                className="min-h-12 flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-subtle"
              />
            </div>
            {failure && (
              <p role="alert" className="px-4 pt-3 text-sm text-destructive">
                {failure}
              </p>
            )}
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="flex-1 text-xs text-subtle">
                {defaultProject
                  ? `Goes to ${defaultProject.name} unless the sentence names another project.`
                  : usageNote(usage.data)}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onAskingChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="ai"
                disabled={!text.trim() || quickAdd.isPending}
              >
                {quickAdd.isPending ? "Drafting…" : "Create with AI"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <QuickAddPreview
        draft={draft}
        projects={usableProjects}
        members={members.data ?? []}
        labels={labels.data ?? []}
        saving={createTaskIn.isPending}
        usageNote={usageNote(usage.data)}
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
                const where = usableProjects.find((p) => p.id === projectId);
                toast.success(
                  `Task created in ${where?.name ?? "the project"}`,
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

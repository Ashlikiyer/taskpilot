"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sparkle } from "@/components/task-ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Schemas } from "@/lib/api/client";
import { assignableMembers, PRIORITIES, type TaskPriority } from "@/lib/tasks";

const NONE = "none";

type Draft = Schemas["QuickAddDraft"];

export type QuickAddConfirm = {
  projectId: string;
  task: Schemas["TaskCreate"];
};

type Props = {
  draft: Draft | null;
  /** Projects the user can add tasks to. */
  projects: Schemas["ProjectOut"][];
  members: Schemas["MemberOut"][];
  labels: Schemas["LabelOut"][];
  saving: boolean;
  error?: string;
  /** e.g. "23 of 50 AI calls used today" */
  usageNote?: string;
  onConfirm: (result: QuickAddConfirm) => void;
  onCancel: () => void;
};

/** Review and edit an AI draft. Nothing is saved until "Create task". */
export function QuickAddPreview(props: Props) {
  return (
    <Dialog
      open={props.draft !== null}
      onOpenChange={(open) => !open && props.onCancel()}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[620px] max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none">
        {props.draft && (
          <PreviewForm
            key={JSON.stringify(props.draft)}
            {...props}
            draft={props.draft}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewForm({
  draft,
  projects,
  members,
  labels,
  saving,
  error,
  usageNote,
  onConfirm,
  onCancel,
}: Props & { draft: Draft }) {
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? "");
  const [projectId, setProjectId] = useState(draft.project_id ?? NONE);
  const [assigneeId, setAssigneeId] = useState(draft.assignee_id ?? NONE);
  const [dueDate, setDueDate] = useState(draft.due_date ?? "");
  const [priority, setPriority] = useState<TaskPriority>(
    draft.priority ?? "medium",
  );
  const [labelIds, setLabelIds] = useState(() =>
    labels
      .filter((l) => (draft.labels ?? []).includes(l.name))
      .map((l) => l.id),
  );
  const [problem, setProblem] = useState<string>();

  const project = projects.find((p) => p.id === projectId);
  const assignees = project ? assignableMembers(members, project) : [];
  // Someone picked by the AI may not be on the project chosen here.
  const assigneeOk =
    assigneeId === NONE || assignees.some((m) => m.user_id === assigneeId);

  const projectItems = [
    { value: NONE, label: "Choose a project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];
  // Keep showing the AI's pick even if they aren't on the chosen project, so the
  // user sees who it was and can change it.
  const strayAssignee = assigneeOk
    ? undefined
    : members.find((m) => m.user_id === assigneeId);
  const assigneeItems = [
    { value: NONE, label: "Unassigned" },
    ...assignees.map((m) => ({ value: m.user_id, label: m.name })),
    ...(strayAssignee
      ? [{ value: strayAssignee.user_id, label: strayAssignee.name }]
      : []),
  ];

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setProblem("Give the task a title.");
    if (!project) return setProblem("Choose a project for the task.");
    if (!assigneeOk)
      return setProblem(
        "The assignee isn't on this project. Pick someone else.",
      );
    setProblem(undefined);
    onConfirm({
      projectId: project.id,
      task: {
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId === NONE ? null : assigneeId,
        due_date: dueDate || null,
        priority,
        label_ids: labelIds,
        source: "ai_quick_add",
      },
    });
  };

  const warnings = draft.warnings ?? [];

  return (
    <form onSubmit={confirm} noValidate>
      <DialogHeader className="gap-1 border-b px-5 py-4">
        <DialogTitle className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.05em] text-ai uppercase">
          <Sparkle className="text-sm" />
          Review the AI draft
        </DialogTitle>
        <DialogDescription className="text-xs">
          Not saved yet. Check the details and change anything that&apos;s off.
        </DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[65vh] gap-4 overflow-y-auto bg-ai-wash px-5 py-4">
        <div className="grid gap-4 rounded-[10px] border border-ai-border bg-card p-4">
          <div className="grid gap-2">
            <Label htmlFor="qa-title">Title</Label>
            <Input
              id="qa-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label id="qa-project-label">Project</Label>
              <Select
                items={projectItems}
                value={projectId}
                onValueChange={(value) => value && setProjectId(value)}
              >
                <SelectTrigger
                  aria-labelledby="qa-project-label"
                  className="w-full"
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
            </div>
            <div className="grid gap-2">
              <Label id="qa-assignee-label">Assignee</Label>
              <Select
                items={assigneeItems}
                value={assigneeId}
                onValueChange={(value) => value && setAssigneeId(value)}
              >
                <SelectTrigger
                  aria-labelledby="qa-assignee-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assigneeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!assigneeOk && (
                <p className="text-xs text-destructive">Not on this project.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qa-due">Due date</Label>
              <Input
                id="qa-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label id="qa-priority-label">Priority</Label>
              <Select
                items={PRIORITIES}
                value={priority}
                onValueChange={(value) => value && setPriority(value)}
              >
                <SelectTrigger
                  aria-labelledby="qa-priority-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {labels.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Labels</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {labels.map((label) => (
                  <span key={label.id} className="flex items-center gap-2">
                    <Checkbox
                      aria-labelledby={`qa-label-${label.id}`}
                      checked={labelIds.includes(label.id)}
                      onCheckedChange={(checked) =>
                        setLabelIds((ids) =>
                          checked
                            ? [...ids, label.id]
                            : ids.filter((id) => id !== label.id),
                        )
                      }
                    />
                    <span id={`qa-label-${label.id}`} className="text-sm">
                      {label.name}
                    </span>
                  </span>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-2">
            <Label htmlFor="qa-description">Description (optional)</Label>
            <Textarea
              id="qa-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {warnings.length > 0 && (
          <div
            role="note"
            className="flex gap-2.5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-[12.5px] text-warning-ink"
          >
            <TriangleAlertIcon
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden
            />
            <div>
              <p className="font-semibold">Please check</p>
              <ul className="list-disc pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(problem || error) && (
          <p role="alert" className="text-sm text-destructive">
            {problem ?? error}
          </p>
        )}
      </div>
      <DialogFooter className="m-0 flex-row items-center gap-2 rounded-none border-t bg-card px-5 py-3 sm:justify-start">
        <span className="flex-1 text-xs text-subtle">{usageNote}</span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Confirm & create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

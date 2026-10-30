"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useAcceptIntake } from "@/hooks/use-intake";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { assignableMembers, PRIORITIES, type TaskPriority } from "@/lib/tasks";

const NONE = "none";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Schemas["IntakeItemOut"];
  project: Schemas["ProjectOut"];
  members: Schemas["MemberOut"][];
  labels: Schemas["LabelOut"][];
};

/** Adjust an intake proposal before accepting it as a task. */
export function IntakeEditDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open && <EditForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ item, project, members, labels, onOpenChange }: Props) {
  const draft = item.draft;
  const accept = useAcceptIntake(project.id);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? "");
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

  const assigneeItems = [
    { value: NONE, label: "Unassigned" },
    ...assignableMembers(members, project).map((m) => ({
      value: m.user_id,
      label: m.name,
    })),
  ];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    accept.mutate(
      {
        id: item.id,
        edits: {
          title: title.trim(),
          description: description.trim() || null,
          assignee_id: assigneeId === NONE ? null : assigneeId,
          due_date: dueDate || null,
          priority,
          label_ids: labelIds,
        },
      },
      {
        onSuccess: () => {
          toast.success("Task created from the request");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit and accept</DialogTitle>
        <DialogDescription>
          Adjust the proposal from {item.sender}. A task is created in{" "}
          {project.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="intake-title">Title</Label>
        <Input
          id="intake-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="intake-description">Description</Label>
        <Textarea
          id="intake-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label id="intake-assignee-label">Assignee</Label>
          <Select
            items={assigneeItems}
            value={assigneeId}
            onValueChange={(value) => value && setAssigneeId(value)}
          >
            <SelectTrigger
              aria-labelledby="intake-assignee-label"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assigneeItems.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="intake-due">Due date</Label>
          <Input
            id="intake-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label id="intake-priority-label">Priority</Label>
          <Select
            items={PRIORITIES}
            value={priority}
            onValueChange={(value) => value && setPriority(value)}
          >
            <SelectTrigger
              aria-labelledby="intake-priority-label"
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
                  aria-labelledby={`intake-label-${label.id}`}
                  checked={labelIds.includes(label.id)}
                  onCheckedChange={(checked) =>
                    setLabelIds((ids) =>
                      checked
                        ? [...ids, label.id]
                        : ids.filter((id) => id !== label.id),
                    )
                  }
                />
                <span id={`intake-label-${label.id}`} className="text-sm">
                  {label.name}
                </span>
              </span>
            ))}
          </div>
        </fieldset>
      )}
      {accept.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(accept.error)}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!title.trim() || accept.isPending}>
          {accept.isPending ? "Creating…" : "Create task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

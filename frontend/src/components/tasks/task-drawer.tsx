"use client";

import { PencilIcon, TagIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SubtaskBreakdown } from "@/components/ai/subtask-breakdown";
import { CommentThread } from "@/components/comments/comment-thread";
import { Markdown } from "@/components/markdown";
import { ErrorState } from "@/components/states";
import { AddTaskInput } from "@/components/tasks/add-task-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-projects";
import { useTaskParam } from "@/hooks/use-task-param";
import {
  useCreateLabel,
  useDeleteTask,
  useLabels,
  useSubtasks,
  useTask,
  useTaskActivity,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspaces";
import { ApiError, errorMessage, type Schemas } from "@/lib/api/client";
import {
  assignableMembers,
  canDeleteTask,
  canEditTasks,
  describeActivity,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUSES,
  timeAgo,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Workspace = Schemas["WorkspaceOut"];
type Project = Schemas["ProjectOut"];

const UNASSIGNED = "unassigned";

/**
 * Opens for `?task=<id>` on any workspace page. It loads the task's own project,
 * so it works from the board, the list, My Tasks or a search result.
 */
export function TaskDrawer({ workspace }: { workspace: Workspace }) {
  const [taskId, setTaskId] = useTaskParam();
  const task = useTask(taskId);
  const project = useProject(task.data?.project_id);
  const me = useMe();
  const notFound =
    (task.error instanceof ApiError && task.error.status === 404) ||
    (project.data !== undefined && project.data.workspace_id !== workspace.id);

  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => !open && setTaskId(null)}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {task.data && project.data && !notFound ? (
          <TaskDetails
            key={task.data.id}
            task={task.data}
            workspace={workspace}
            project={project.data}
            canEdit={canEditTasks(workspace, project.data, me.data?.id)}
            onOpenTask={setTaskId}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>{notFound ? "Task not found" : "Task"}</SheetTitle>
            <SheetDescription>
              {notFound ? "It may have been deleted." : "Loading task details."}
            </SheetDescription>
            {(task.isPending || (task.data && project.isPending)) &&
              !notFound && <Skeleton className="mt-4 h-24" aria-busy />}
            {(task.isError || project.isError) && !notFound && (
              <ErrorState
                message="We couldn't load this task."
                onRetry={() => {
                  task.refetch();
                  project.refetch();
                }}
              />
            )}
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetails({
  task,
  workspace,
  project,
  canEdit,
  onOpenTask,
}: {
  task: Task;
  workspace: Workspace;
  project: Project;
  canEdit: boolean;
  onOpenTask: (id: string | null) => void;
}) {
  const me = useMe();
  const members = useMembers(workspace.id);
  const update = useUpdateTask(task.id);
  const parent = useTask(task.parent_id);
  const memberNames = Object.fromEntries(
    (members.data ?? []).map((m) => [m.user_id, m.name]),
  );

  const save = (data: Schemas["TaskUpdate"]) =>
    update.mutate(data, {
      onError: (error) => toast.error(errorMessage(error)),
    });

  const assigneeItems = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assignableMembers(members.data ?? [], project).map((m) => ({
      value: m.user_id,
      label: m.name,
    })),
  ];

  return (
    <div className="grid gap-6 p-4">
      <SheetHeader className="p-0">
        {task.parent_id && (
          <button
            type="button"
            className="w-fit text-left text-sm text-muted-foreground hover:underline"
            onClick={() => onOpenTask(task.parent_id)}
          >
            Subtask of {parent.data?.title ?? "parent task"}
          </button>
        )}
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <SheetDescription className="sr-only">
          Task details and history
        </SheetDescription>
        {canEdit ? (
          <TitleInput title={task.title} onSave={(title) => save({ title })} />
        ) : (
          <p className="text-xl font-semibold">{task.title}</p>
        )}
      </SheetHeader>

      <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd>
          {canEdit ? (
            <Select
              items={STATUSES}
              value={task.status}
              onValueChange={(status) => status && save({ status })}
            >
              <SelectTrigger className="w-40" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            STATUS_LABEL[task.status]
          )}
        </dd>

        <dt className="text-muted-foreground">Priority</dt>
        <dd>
          {canEdit ? (
            <Select
              items={PRIORITIES}
              value={task.priority}
              onValueChange={(priority) => priority && save({ priority })}
            >
              <SelectTrigger className="w-40" aria-label="Priority">
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
          ) : (
            PRIORITY_LABEL[task.priority]
          )}
        </dd>

        <dt className="text-muted-foreground">Assignee</dt>
        <dd>
          {canEdit ? (
            <Select
              items={assigneeItems}
              value={task.assignee_id ?? UNASSIGNED}
              onValueChange={(value) =>
                value &&
                save({ assignee_id: value === UNASSIGNED ? null : value })
              }
            >
              <SelectTrigger className="w-40" aria-label="Assignee">
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
          ) : (
            (task.assignee_id && memberNames[task.assignee_id]) || "Unassigned"
          )}
        </dd>

        <dt>
          <Label
            htmlFor="task-due-date"
            className="font-normal text-muted-foreground"
          >
            Due date
          </Label>
        </dt>
        <dd>
          <Input
            id="task-due-date"
            type="date"
            className="w-40"
            value={task.due_date ?? ""}
            disabled={!canEdit}
            onChange={(e) => save({ due_date: e.target.value || null })}
          />
        </dd>

        <dt className="text-muted-foreground">Labels</dt>
        <dd>
          <LabelPicker
            task={task}
            workspaceId={workspace.id}
            canEdit={canEdit}
            onSave={save}
          />
        </dd>
      </dl>

      <DescriptionField
        description={task.description}
        canEdit={canEdit}
        onSave={(description) => save({ description })}
      />

      {task.parent_id === null && (
        <Subtasks task={task} canEdit={canEdit} onOpenTask={onOpenTask} />
      )}

      <CommentThread
        taskId={task.id}
        members={members.data ?? []}
        currentUserId={me.data?.id}
        canComment={project.archived_at === null}
        canUseAI={workspace.role !== "viewer"}
      />

      <Activity taskId={task.id} memberNames={memberNames} />

      {canEdit && canDeleteTask(workspace, task, me.data?.id) && (
        <DeleteTaskButton
          task={task}
          onDeleted={() => onOpenTask(task.parent_id)}
        />
      )}
    </div>
  );
}

function TitleInput({
  title,
  onSave,
}: {
  title: string;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(title);
  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) setValue(title);
    else if (trimmed !== title) onSave(trimmed);
  };
  return (
    <Input
      aria-label="Title"
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-auto border-transparent px-1 text-xl font-semibold shadow-none hover:border-input"
    />
  );
}

function DescriptionField({
  description,
  canEdit,
  onSave,
}: {
  description: string | null;
  canEdit: boolean;
  onSave: (description: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");

  if (editing) {
    const save = () => {
      const next = value.trim() || null;
      if (next !== description) onSave(next);
      setEditing(false);
    };
    return (
      <section className="grid gap-2">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          rows={6}
          autoFocus
          value={value}
          placeholder="Add details, links or a checklist. Markdown is supported."
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
            if (e.key === "Escape") {
              e.stopPropagation();
              setValue(description ?? "");
              setEditing(false);
            }
          }}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(description ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Description</h3>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <PencilIcon />
            {description ? "Edit" : "Add"}
          </Button>
        )}
      </div>
      {description ? (
        <Markdown>{description}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">No description.</p>
      )}
    </section>
  );
}

function LabelPicker({
  task,
  workspaceId,
  canEdit,
  onSave,
}: {
  task: Task;
  workspaceId: string;
  canEdit: boolean;
  onSave: (data: Schemas["TaskUpdate"]) => void;
}) {
  const labels = useLabels(canEdit ? workspaceId : undefined);
  const createLabel = useCreateLabel(workspaceId);
  const [newName, setNewName] = useState("");
  const selected = task.labels.map((l) => l.id);

  const toggle = (id: string, checked: boolean) =>
    onSave({
      label_ids: checked
        ? [...selected, id]
        : selected.filter((lid) => lid !== id),
    });

  const addLabel = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createLabel.mutate(
      { name },
      {
        onSuccess: (label) => {
          setNewName("");
          onSave({ label_ids: [...selected, label.id] });
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.labels.map((label) => (
        <span
          key={label.id}
          className="rounded-full border px-2 py-0.5 text-xs"
          style={{ borderColor: label.color, color: label.color }}
        >
          {label.name}
        </span>
      ))}
      {!canEdit && task.labels.length === 0 && <span>None</span>}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <TagIcon />
            Edit labels
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {labels.data?.length === 0 && (
                <p className="px-2 py-1 text-sm text-muted-foreground">
                  No labels yet.
                </p>
              )}
              {labels.data?.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={selected.includes(label.id)}
                  onCheckedChange={(checked) => toggle(label.id, checked)}
                >
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <form onSubmit={addLabel} className="flex gap-1 border-t p-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="New label"
                aria-label="New label name"
                maxLength={50}
                className="h-7"
              />
              <Button type="submit" size="sm" disabled={!newName.trim()}>
                Add
              </Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function Subtasks({
  task,
  canEdit,
  onOpenTask,
}: {
  task: Task;
  canEdit: boolean;
  onOpenTask: (id: string) => void;
}) {
  const subtasks = useSubtasks(task);
  const percent =
    task.subtask_count > 0
      ? Math.round((task.subtasks_done / task.subtask_count) * 100)
      : 0;

  return (
    <section aria-labelledby="subtasks-heading" className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 id="subtasks-heading" className="text-sm font-medium">
          Subtasks
        </h3>
        {task.subtask_count > 0 && (
          <span className="text-sm text-muted-foreground">
            {task.subtasks_done}/{task.subtask_count} done
          </span>
        )}
      </div>
      {task.subtask_count > 0 && (
        <div
          role="progressbar"
          aria-label="Subtask progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {subtasks.isError && (
        <ErrorState
          message="We couldn't load subtasks."
          onRetry={() => subtasks.refetch()}
        />
      )}
      <ul className="grid gap-1">
        {subtasks.data?.items.map((subtask) => (
          <SubtaskItem
            key={subtask.id}
            subtask={subtask}
            canEdit={canEdit}
            onOpen={() => onOpenTask(subtask.id)}
          />
        ))}
      </ul>
      {canEdit && (
        <>
          <AddTaskInput
            projectId={task.project_id}
            parentId={task.id}
            placeholder="Add a subtask"
          />
          <SubtaskBreakdown taskId={task.id} projectId={task.project_id} />
        </>
      )}
    </section>
  );
}

function SubtaskItem({
  subtask,
  canEdit,
  onOpen,
}: {
  subtask: Task;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const update = useUpdateTask(subtask.id);
  const done = subtask.status === "done";
  const labelId = `subtask-${subtask.id}`;

  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
      <Checkbox
        checked={done}
        disabled={!canEdit || update.isPending}
        aria-labelledby={labelId}
        onCheckedChange={(checked) =>
          update.mutate(
            { status: checked ? "done" : "todo" },
            { onError: (error) => toast.error(errorMessage(error)) },
          )
        }
      />
      <button
        id={labelId}
        type="button"
        onClick={onOpen}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm",
          done && "text-muted-foreground line-through",
        )}
      >
        {subtask.title}
      </button>
    </li>
  );
}

function Activity({
  taskId,
  memberNames,
}: {
  taskId: string;
  memberNames: Record<string, string>;
}) {
  const activity = useTaskActivity(taskId);
  return (
    <section aria-labelledby="activity-heading" className="grid gap-2">
      <h3 id="activity-heading" className="text-sm font-medium">
        Activity
      </h3>
      {activity.isPending && <Skeleton className="h-12" />}
      {activity.isError && (
        <ErrorState
          message="We couldn't load activity."
          onRetry={() => activity.refetch()}
        />
      )}
      <ol className="grid gap-2">
        {activity.data?.map((entry) => (
          <li key={entry.id} className="text-sm">
            <span className="font-medium">
              {entry.actor_name ?? "TaskPilot"}
            </span>{" "}
            <span className="text-muted-foreground">
              {describeActivity(entry, memberNames)}
            </span>{" "}
            <time
              dateTime={entry.created_at}
              className="text-xs text-muted-foreground"
            >
              · {timeAgo(entry.created_at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DeleteTaskButton({
  task,
  onDeleted,
}: {
  task: Task;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const deleteTask = useDeleteTask(task);

  return (
    <>
      <Button
        variant="ghost"
        className="w-fit text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        Delete task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              {task.subtask_count > 0
                ? `Its ${task.subtask_count} subtasks will be deleted too. `
                : ""}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteTask.isPending}
              onClick={() =>
                deleteTask.mutate(undefined, {
                  onSuccess: () => {
                    setOpen(false);
                    toast.success("Task deleted");
                    onDeleted();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              {deleteTask.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  ListChecksIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUpdateTask } from "@/hooks/use-tasks";
import { errorMessage, type Schemas } from "@/lib/api/client";
import { nextSort, type SortField, type TaskFilters } from "@/lib/task-filters";
import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUSES,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

const UNASSIGNED = "unassigned";

type Props = {
  tasks: Task[];
  sort: TaskFilters["sort"];
  onSortChange: (sort: TaskFilters["sort"]) => void;
  canEdit: boolean;
  /** People who can be assigned on this project. */
  assignees: Schemas["MemberOut"][];
  memberNames: Record<string, string>;
  onOpen: (taskId: string) => void;
};

export function TaskTable({
  tasks,
  sort,
  onSortChange,
  canEdit,
  assignees,
  memberNames,
  onOpen,
}: Props) {
  const header = (field: SortField, label: string) => {
    const active = sort?.field === field;
    const Icon = !active
      ? ChevronsUpDownIcon
      : sort.desc
        ? ArrowDownIcon
        : ArrowUpIcon;
    return (
      <TableHead
        aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      >
        <button
          type="button"
          onClick={() => onSortChange(nextSort(sort, field))}
          className="flex items-center gap-1 font-medium hover:text-foreground"
        >
          {label}
          <Icon
            className={cn("size-3.5", !active && "text-muted-foreground/60")}
            aria-hidden
          />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {header("title", "Title")}
            {header("status", "Status")}
            {header("priority", "Priority")}
            <TableHead>Assignee</TableHead>
            {header("due_date", "Due")}
            <TableHead>Labels</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskTableRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              assignees={assignees}
              memberNames={memberNames}
              onOpen={() => onOpen(task.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TaskTableRow({
  task,
  canEdit,
  assignees,
  memberNames,
  onOpen,
}: {
  task: Task;
  canEdit: boolean;
  assignees: Schemas["MemberOut"][];
  memberNames: Record<string, string>;
  onOpen: () => void;
}) {
  const update = useUpdateTask(task.id);
  const save = (data: Schemas["TaskUpdate"]) =>
    update.mutate(data, {
      onError: (error) => toast.error(errorMessage(error)),
    });

  const assigneeItems = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...assignees.map((m) => ({ value: m.user_id, label: m.name })),
  ];
  const assigneeName = task.assignee_id
    ? (memberNames[task.assignee_id] ?? "Former member")
    : "Unassigned";

  return (
    <TableRow>
      <TableCell className="max-w-80 min-w-48">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex items-center gap-2 text-left font-medium hover:underline",
            task.status === "done" && "text-muted-foreground line-through",
          )}
        >
          <span className="line-clamp-2">{task.title}</span>
          {task.subtask_count > 0 && (
            <span
              className="flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground"
              title={`${task.subtasks_done} of ${task.subtask_count} subtasks done`}
            >
              <ListChecksIcon className="size-3.5" aria-hidden />
              {task.subtasks_done}/{task.subtask_count}
            </span>
          )}
        </button>
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select
            items={STATUSES}
            value={task.status}
            onValueChange={(status) =>
              status && status !== task.status && save({ status })
            }
          >
            <SelectTrigger
              className="w-32"
              aria-label={`Status of ${task.title}`}
            >
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
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            PRIORITY_CLASS[task.priority],
          )}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Select
            items={assigneeItems}
            value={task.assignee_id ?? UNASSIGNED}
            onValueChange={(value) => {
              const next = !value || value === UNASSIGNED ? null : value;
              if (next !== task.assignee_id) save({ assignee_id: next });
            }}
          >
            <SelectTrigger
              className="w-36"
              aria-label={`Assignee of ${task.title}`}
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
        ) : (
          assigneeName
        )}
      </TableCell>
      <TableCell>
        {canEdit ? (
          <Input
            type="date"
            className="w-36"
            aria-label={`Due date of ${task.title}`}
            value={task.due_date ?? ""}
            onChange={(e) => save({ due_date: e.target.value || null })}
          />
        ) : task.due_date ? (
          formatDueDate(task.due_date)
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full border px-1.5 text-xs"
              style={{ borderColor: label.color, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </span>
      </TableCell>
    </TableRow>
  );
}

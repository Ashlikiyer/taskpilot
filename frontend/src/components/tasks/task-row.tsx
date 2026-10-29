import { CalendarIcon, ListChecksIcon } from "lucide-react";

import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskRow({
  task,
  assigneeName,
  onOpen,
}: {
  task: Task;
  assigneeName: string | undefined;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "min-w-0 flex-1 basis-48 truncate text-sm",
          task.status === "done" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs">
        {task.labels.map((label) => (
          <span
            key={label.id}
            className="rounded-full border px-2 py-0.5"
            style={{ borderColor: label.color, color: label.color }}
          >
            {label.name}
          </span>
        ))}
        {task.subtask_count > 0 && (
          <span
            className="flex items-center gap-1 text-muted-foreground"
            title={`${task.subtasks_done} of ${task.subtask_count} subtasks done`}
          >
            <ListChecksIcon className="size-3.5" aria-hidden />
            {task.subtasks_done}/{task.subtask_count}
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CalendarIcon className="size-3.5" aria-hidden />
            {formatDueDate(task.due_date)}
          </span>
        )}
        <span
          className={cn("rounded px-1.5 py-0.5", PRIORITY_CLASS[task.priority])}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        <span className="w-24 truncate text-muted-foreground">
          {assigneeName ?? "Unassigned"}
        </span>
      </span>
    </button>
  );
}

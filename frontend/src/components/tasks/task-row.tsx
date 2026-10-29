import { CalendarIcon, ListChecksIcon } from "lucide-react";

import type { Schemas } from "@/lib/api/client";
import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** A one-line task with its project, used on My Tasks. */
export function TaskRow({
  task,
  project,
  onOpen,
}: {
  task: Task;
  project: Pick<Schemas["ProjectOut"], "name" | "color"> | undefined;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1 basis-48 truncate text-sm">
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {project && (
          <span className="flex max-w-36 items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate">{project.name}</span>
          </span>
        )}
        <span>{STATUS_LABEL[task.status]}</span>
        {task.subtask_count > 0 && (
          <span
            className="flex items-center gap-1"
            title={`${task.subtasks_done} of ${task.subtask_count} subtasks done`}
          >
            <ListChecksIcon className="size-3.5" aria-hidden />
            {task.subtasks_done}/{task.subtask_count}
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="size-3.5" aria-hidden />
            {formatDueDate(task.due_date)}
          </span>
        )}
        <span
          className={cn("rounded px-1.5 py-0.5", PRIORITY_CLASS[task.priority])}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      </span>
    </button>
  );
}

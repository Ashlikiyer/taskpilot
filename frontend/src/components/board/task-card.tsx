"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon, ListChecksIcon } from "lucide-react";

import {
  formatDueDate,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

type CardProps = {
  task: Task;
  assigneeName: string | undefined;
  onOpen: () => void;
};

/** The card's content, shared by the draggable card and the drag overlay. */
export function TaskCardBody({
  task,
  assigneeName,
}: Omit<CardProps, "onOpen">) {
  return (
    <>
      <span className="text-sm font-medium break-words">{task.title}</span>
      {task.labels.length > 0 && (
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
      )}
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn("rounded px-1.5 py-0.5", PRIORITY_CLASS[task.priority])}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.due_date && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="size-3.5" aria-hidden />
            {formatDueDate(task.due_date)}
          </span>
        )}
        {task.subtask_count > 0 && (
          <span
            className="flex items-center gap-1"
            title={`${task.subtasks_done} of ${task.subtask_count} subtasks done`}
          >
            <ListChecksIcon className="size-3.5" aria-hidden />
            {task.subtasks_done}/{task.subtask_count}
          </span>
        )}
        <span className="ml-auto max-w-28 truncate">
          {assigneeName ?? "Unassigned"}
        </span>
      </span>
    </>
  );
}

const cardClass =
  "flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** A card that can be dragged with the mouse, touch, or Space + arrow keys. */
export function SortableTaskCard({ task, assigneeName, onOpen }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <div
        {...attributes}
        {...listeners}
        aria-roledescription="draggable task"
        aria-label={`${task.title}. Press Enter to open, Space to move.`}
        onClick={onOpen}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event);
          if (event.key === "Enter" && !isDragging) onOpen();
        }}
        className={cn(
          cardClass,
          "cursor-grab touch-manipulation hover:border-ring/50",
        )}
      >
        <TaskCardBody task={task} assigneeName={assigneeName} />
      </div>
    </li>
  );
}

/** A read-only card for people who can't move tasks. */
export function StaticTaskCard({ task, assigneeName, onOpen }: CardProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(cardClass, "hover:border-ring/50")}
      >
        <TaskCardBody task={task} assigneeName={assigneeName} />
      </button>
    </li>
  );
}

export function OverlayTaskCard(props: Omit<CardProps, "onOpen">) {
  return (
    <div
      className={cn(
        cardClass,
        "cursor-grabbing shadow-lg ring-2 ring-primary/40",
      )}
    >
      <TaskCardBody {...props} />
    </div>
  );
}

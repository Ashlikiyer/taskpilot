"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon, MessageSquareIcon } from "lucide-react";

import { AIBadge, Avatar, PriorityPill } from "@/components/task-ui";
import { formatDueDate, isOverdue, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type CardProps = {
  task: Task;
  assigneeName: string | undefined;
  onOpen: () => void;
};

/** Tasks the AI drafted (quick-add or intake) get the violet AI mark. */
export function isAIDrafted(task: Pick<Task, "source">): boolean {
  return task.source === "ai_quick_add" || task.source === "intake";
}

/** The card's content, shared by the draggable card and the drag overlay. */
export function TaskCardBody({
  task,
  assigneeName,
}: Omit<CardProps, "onOpen">) {
  const late = isOverdue(task);
  const comments = task.comment_count ?? 0;
  const progress =
    task.subtask_count > 0
      ? Math.round((task.subtasks_done / task.subtask_count) * 100)
      : 0;
  return (
    <>
      <span className="flex items-center gap-1.5">
        <PriorityPill priority={task.priority} />
        {isAIDrafted(task) && (
          <span className="ml-auto">
            <AIBadge />
          </span>
        )}
      </span>
      <span className="grid gap-1">
        <span className="text-[13.5px] leading-snug font-semibold break-words text-pretty">
          {task.title}
        </span>
        {task.description && (
          <span className="line-clamp-2 text-xs leading-normal text-[#77777c]">
            {task.description}
          </span>
        )}
      </span>
      {task.labels.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="flex items-center gap-1.5 rounded-md border border-[#ececea] px-2 py-0.5 text-[11px] text-[#4a4a50]"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-[2px]"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
        </span>
      )}
      {task.subtask_count > 0 && (
        <span
          className="flex items-center gap-2"
          title={`${task.subtasks_done} of ${task.subtask_count} subtasks done`}
        >
          <span className="h-1 flex-1 overflow-hidden rounded-sm bg-[#efefec]">
            <span
              className="block h-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {task.subtasks_done}/{task.subtask_count}
            <span className="sr-only"> subtasks done</span>
          </span>
        </span>
      )}
      <span className="flex items-center gap-2.5 border-t border-dashed border-[#ececea] pt-2.5 text-[11.5px] text-[#77777c]">
        {assigneeName ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar
              name={assigneeName}
              id={task.assignee_id ?? undefined}
              size="sm"
            />
            <span className="sr-only">Assigned to {assigneeName}</span>
          </span>
        ) : (
          <span className="text-subtle">Unassigned</span>
        )}
        {comments > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <MessageSquareIcon className="size-3" aria-hidden />
            {comments}
            <span className="sr-only">
              {comments === 1 ? " comment" : " comments"}
            </span>
          </span>
        )}
        {task.due_date && (
          <span
            className={cn(
              "flex items-center gap-1",
              comments === 0 && "ml-auto",
              late && "font-medium text-overdue",
            )}
          >
            <CalendarIcon className="size-3" aria-hidden />
            {formatDueDate(task.due_date)}
            {late && <span className="sr-only"> (overdue)</span>}
          </span>
        )}
      </span>
    </>
  );
}

const cardClass =
  "flex w-full flex-col gap-2.5 rounded-xl border border-[#ececea] bg-card px-3.5 py-[13px] text-left shadow-[0_1px_2px_rgba(20,20,30,.04)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const aiCardClass = (task: Task) => isAIDrafted(task) && "border-[#e3dcfb]";

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
          aiCardClass(task),
          "cursor-grab touch-manipulation hover:border-[#cfcfca]",
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
        className={cn(cardClass, aiCardClass(task), "hover:border-[#cfcfca]")}
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

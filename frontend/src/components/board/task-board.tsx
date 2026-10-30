"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { toast } from "sonner";

import {
  OverlayTaskCard,
  SortableTaskCard,
  StaticTaskCard,
} from "@/components/board/task-card";
import { StatusDot } from "@/components/task-ui";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskParam } from "@/hooks/use-task-param";
import { useMoveTask, useProjectTasks } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspaces";
import { errorMessage, type Schemas } from "@/lib/api/client";
import {
  columnId,
  type Columns,
  findColumn,
  moveToColumn,
  placement,
  positionBetween,
  reorder,
} from "@/lib/board";
import { groupByStatus, STATUS_LABEL, STATUSES, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskBoard({
  workspace,
  project,
  canEdit,
}: {
  workspace: Schemas["WorkspaceOut"];
  project: Schemas["ProjectOut"];
  canEdit: boolean;
}) {
  const tasks = useProjectTasks(project.id);
  const members = useMembers(workspace.id);
  const moveTask = useMoveTask(project.id);
  const [, openTask] = useTaskParam();
  // While a card is being dragged, the board shows this draft instead of the cache.
  const [draft, setDraft] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens the task, so only Space picks a card up.
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Enter"],
      },
    }),
  );

  if (tasks.isPending) {
    return (
      <div className="flex gap-4 overflow-hidden" aria-busy>
        {STATUSES.map((s) => (
          <Skeleton key={s.value} className="h-64 w-72 shrink-0" />
        ))}
      </div>
    );
  }
  if (tasks.isError) {
    return (
      <ErrorState
        message="We couldn't load tasks."
        onRetry={() => tasks.refetch()}
      />
    );
  }
  if (tasks.data.items.length === 0) {
    return (
      <EmptyState
        title="No tasks yet"
        description={
          canEdit
            ? "Add the first task above. Press Enter to save it."
            : "Tasks added by the team will show up here."
        }
      />
    );
  }

  const columns = draft ?? groupByStatus(tasks.data.items);
  const names = Object.fromEntries(
    (members.data ?? []).map((m) => [m.user_id, m.name]),
  );
  const byId = new Map(tasks.data.items.map((task) => [task.id, task]));
  const activeTask = activeId ? byId.get(activeId) : undefined;
  const title = (id: string | number) => byId.get(String(id))?.title ?? "Task";
  const columnName = (id: string | number | undefined) => {
    const status =
      id === undefined ? undefined : findColumn(columns, String(id));
    return status ? STATUS_LABEL[status] : "the board";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${title(active.id)} is over ${columnName(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} was dropped in ${columnName(over.id)}.`
        : `${title(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${title(active.id)} was cancelled.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDraft(groupByStatus(tasks.data.items));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setDraft(
      (current) =>
        current && moveToColumn(current, String(active.id), String(over.id)),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const original = byId.get(id);
    const finalColumns =
      draft && over ? reorder(draft, id, String(over.id)) : null;
    setActiveId(null);
    setDraft(null);
    if (!original || !finalColumns) return;

    const target = placement(finalColumns, id);
    if (!target) return;
    const before = target.before && byId.get(target.before.id);
    const after = target.after && byId.get(target.after.id);
    const unchanged =
      target.status === original.status &&
      placement(groupByStatus(tasks.data.items), id)?.before?.id === before?.id;
    if (unchanged) return;

    moveTask(
      {
        task: original,
        status: target.status,
        before,
        after,
        position: positionBetween(before, after),
      },
      (error) => toast.error(`Couldn't move the task: ${errorMessage(error)}`),
    );
  };

  const board = (
    <div
      className="-mx-4 flex snap-x scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
      role="list"
      aria-label="Board columns"
    >
      {STATUSES.map(({ value: status, label }) => (
        <BoardColumn
          key={status}
          status={status}
          label={label}
          count={columns[status].length}
        >
          <SortableContext
            id={columnId(status)}
            items={columns[status].map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="grid min-h-16 content-start gap-2.5">
              {columns[status].map((task) => {
                const props = {
                  task,
                  assigneeName: task.assignee_id
                    ? names[task.assignee_id]
                    : undefined,
                  onOpen: () => openTask(task.id),
                };
                return canEdit ? (
                  <SortableTaskCard key={task.id} {...props} />
                ) : (
                  <StaticTaskCard key={task.id} {...props} />
                );
              })}
            </ul>
          </SortableContext>
        </BoardColumn>
      ))}
    </div>
  );

  if (!canEdit) return board;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a task, press Space. Use the arrow keys to move it between columns, Space to drop it, or Escape to cancel. Press Enter to open it.",
        },
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      {board}
      <DragOverlay>
        {activeTask && (
          <OverlayTaskCard
            task={activeTask}
            assigneeName={
              activeTask.assignee_id ? names[activeTask.assignee_id] : undefined
            }
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// The design marks each column header with a 2px line in its status color.
const COLUMN_TOP_LINE: Record<Task["status"], string> = {
  todo: "shadow-[inset_0_2px_0_var(--status-todo)]",
  in_progress: "shadow-[inset_0_2px_0_var(--status-in-progress)]",
  in_review: "shadow-[inset_0_2px_0_var(--status-in-review)]",
  done: "shadow-[inset_0_2px_0_var(--status-done)]",
};

function BoardColumn({
  status,
  label,
  count,
  children,
}: {
  status: Task["status"];
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) });
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-label={`${label}, ${count} ${count === 1 ? "task" : "tasks"}`}
      className={cn(
        "flex w-[280px] shrink-0 snap-start flex-col gap-2.5 rounded-xl transition-colors md:w-auto md:min-w-[230px] md:flex-1",
        isOver && "bg-muted",
      )}
    >
      <h3
        className={cn(
          "flex items-center gap-2 rounded-[10px] border border-[#ececea] bg-card px-3 py-[9px] text-[13px] font-semibold",
          COLUMN_TOP_LINE[status],
        )}
      >
        <StatusDot status={status} />
        {label}
        <span className="rounded-full bg-accent px-1.5 font-mono text-[10.5px] font-normal text-muted-foreground">
          {count}
        </span>
      </h3>
      {children}
    </section>
  );
}

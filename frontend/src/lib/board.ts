import { STATUSES, type Task, type TaskStatus } from "@/lib/tasks";

export type Columns = Record<TaskStatus, Task[]>;

const COLUMN_PREFIX = "column:";

export const columnId = (status: TaskStatus) => `${COLUMN_PREFIX}${status}`;

/** The column a drag id belongs to: a column's own id, or the column holding that card. */
export function findColumn(
  columns: Columns,
  id: string,
): TaskStatus | undefined {
  if (id.startsWith(COLUMN_PREFIX))
    return id.slice(COLUMN_PREFIX.length) as TaskStatus;
  return STATUSES.map((s) => s.value).find((status) =>
    columns[status].some((task) => task.id === id),
  );
}

/**
 * Move a card to another column while dragging, placing it where the pointer is
 * (before the card it's over, or at the end when over the empty column).
 */
export function moveToColumn(
  columns: Columns,
  activeId: string,
  overId: string,
): Columns {
  const from = findColumn(columns, activeId);
  const to = findColumn(columns, overId);
  if (!from || !to || from === to) return columns;

  const card = columns[from].find((task) => task.id === activeId);
  if (!card) return columns;
  const target = columns[to];
  const overIndex = target.findIndex((task) => task.id === overId);
  const index = overIndex === -1 ? target.length : overIndex;

  return {
    ...columns,
    [from]: columns[from].filter((task) => task.id !== activeId),
    [to]: [
      ...target.slice(0, index),
      { ...card, status: to },
      ...target.slice(index),
    ],
  };
}

/** Reorder within a column (dnd-kit's arrayMove, kept local to stay framework-free). */
export function reorder(
  columns: Columns,
  activeId: string,
  overId: string,
): Columns {
  const status = findColumn(columns, activeId);
  if (
    !status ||
    status !== findColumn(columns, overId) ||
    activeId === overId
  ) {
    return columns;
  }
  const list = [...columns[status]];
  const from = list.findIndex((task) => task.id === activeId);
  const to = list.findIndex((task) => task.id === overId);
  const [card] = list.splice(from, 1);
  list.splice(to, 0, card);
  return { ...columns, [status]: list };
}

/** Where a card ended up: its column plus the cards directly above and below it. */
export function placement(columns: Columns, taskId: string) {
  const status = findColumn(columns, taskId);
  if (!status) return undefined;
  const list = columns[status];
  const index = list.findIndex((task) => task.id === taskId);
  return {
    status,
    before: list[index - 1] as Task | undefined,
    after: list[index + 1] as Task | undefined,
  };
}

/** Mirrors the backend's midpoint rule so the optimistic position sorts correctly. */
export function positionBetween(before?: Task, after?: Task): number {
  const GAP = 1024;
  if (!before && !after) return GAP;
  if (!before) return after!.position - GAP;
  if (!after) return before.position + GAP;
  return (before.position + after.position) / 2;
}

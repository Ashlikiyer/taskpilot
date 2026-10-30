import { PriorityPill, StatusLabel } from "@/components/task-ui";
import type { Schemas } from "@/lib/api/client";
import { formatDueDate, isOverdue, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Column template shared by the row and its header (md and up). */
export const TASK_ROW_COLUMNS =
  "md:grid md:grid-cols-[28px_minmax(0,1fr)_170px_90px_110px_110px] md:items-center md:gap-0";

/** A one-line task with its project, used on My Tasks. Stacks on small screens. */
export function TaskRow({
  task,
  project,
  onOpen,
}: {
  task: Task;
  project: Pick<Schemas["ProjectOut"], "name" | "color"> | undefined;
  onOpen: () => void;
}) {
  const late = isOverdue(task);
  const due = task.due_date ? formatDueDate(task.due_date) : "—";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 px-[18px] py-3 text-left text-[13px] hover:bg-muted focus-visible:bg-muted focus-visible:outline-none md:h-10 md:px-8 md:py-0",
        TASK_ROW_COLUMNS,
      )}
    >
      <span
        aria-hidden
        className="mt-px size-[18px] shrink-0 rounded-full border-[1.5px] border-[#c9c9cc] md:size-3.5"
      />
      <span className="grid min-w-0 gap-1 md:block">
        <span className="block text-sm break-words md:truncate md:pr-3 md:text-[13px]">
          {task.title}
        </span>
        {/* Small screens: due date and project under the title. */}
        <span className="flex gap-2 text-xs text-[#77777c] md:hidden">
          <span className={cn(late && "text-overdue")}>{due}</span>·
          <span className="truncate">{project?.name}</span>
        </span>
      </span>
      <span className="hidden min-w-0 items-center gap-1.5 text-[12.5px] text-[#55555b] md:flex">
        {project && (
          <>
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <span className="truncate">{project.name}</span>
          </>
        )}
      </span>
      <span className="hidden md:block">
        <PriorityPill priority={task.priority} />
      </span>
      <span className="hidden text-[12.5px] text-[#55555b] md:block">
        <StatusLabel status={task.status} />
      </span>
      <span
        className={cn(
          "hidden text-[12.5px] text-[#55555b] md:block",
          late && "text-overdue",
        )}
      >
        {due}
        {late && <span className="sr-only"> (overdue)</span>}
      </span>
    </button>
  );
}

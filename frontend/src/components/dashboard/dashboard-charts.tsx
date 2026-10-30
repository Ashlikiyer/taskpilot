/**
 * Dashboard pieces, drawn with plain elements and Tailwind (no chart library).
 * Each chart is a figure whose bars are hidden from screen readers and paired
 * with a visually hidden table holding the same numbers.
 */
import type { Schemas } from "@/lib/api/client";
import { STATUS_DOT_CLASS, STATUS_LABEL, type TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Dashboard = Schemas["DashboardOut"];

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-xl border bg-card p-[18px]",
        className,
      )}
    >
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {children}
    </figure>
  );
}

/** ISO week number, for the "W44" labels under each bar. */
export function isoWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
}

function weekLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "2 more than last week" for the overdue tile. */
export function overdueChange(now: number, weekAgo: number): string {
  const diff = now - weekAgo;
  if (diff === 0) return "same as last week";
  return `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than last week`;
}

export function StatCards({ data }: { data: Dashboard }) {
  const weeks = data.completed_per_week;
  const average = weeks.length
    ? Math.round(weeks.reduce((sum, w) => sum + w.count, 0) / weeks.length)
    : 0;
  const aiShare = data.created_recently
    ? Math.round((data.created_by_ai / data.created_recently) * 100)
    : 0;
  const stats = [
    {
      label: "Open tasks",
      value: String(data.open_total),
      note:
        data.project_id === null
          ? `across ${data.open_projects} ${data.open_projects === 1 ? "project" : "projects"}`
          : "in this project",
      tone: "",
    },
    {
      label: "Overdue",
      value: String(data.overdue),
      note: overdueChange(data.overdue, data.overdue_week_ago),
      tone: data.overdue > 0 ? "text-overdue" : "",
    },
    {
      label: "Completed this week",
      value: String(data.completed_this_week),
      note: `8-week avg ${average}`,
      tone: "",
    },
    {
      label: "Created by AI",
      value: `${aiShare}%`,
      note: "quick-add, intake, import · 8 weeks",
      tone: "text-ai",
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <li
          key={stat.label}
          className="grid gap-1.5 rounded-xl border bg-card px-[18px] py-4"
        >
          <span className="text-[12.5px] text-muted-foreground">
            {stat.label}
          </span>
          <span
            className={cn(
              "text-[30px] leading-none font-semibold tracking-[-0.02em]",
              stat.tone,
            )}
          >
            {stat.value}
          </span>
          <span className="text-xs text-subtle">{stat.note}</span>
        </li>
      ))}
    </ul>
  );
}

export function CompletedPerWeekChart({
  weeks,
}: {
  weeks: Dashboard["completed_per_week"];
}) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const empty = weeks.every((w) => w.count === 0);
  return (
    <Card title="Completed per week" className="min-h-72">
      {empty ? (
        <p className="m-auto text-[13px] text-muted-foreground">
          Nothing completed in the last 8 weeks yet.
        </p>
      ) : (
        <div aria-hidden className="flex flex-1 flex-col gap-2">
          <div className="flex min-h-44 flex-1 items-end gap-2 border-b sm:gap-3.5">
            {weeks.map((week, index) => {
              const current = index === weeks.length - 1;
              return (
                <div
                  key={week.week_start}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {week.count}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-[4px] transition-colors",
                      current
                        ? "bg-primary"
                        : "bg-[#d6e9dc] group-hover:bg-[#bcdcc6]",
                    )}
                    style={{
                      height: `${(week.count / max) * 100}%`,
                      minHeight: week.count ? 2 : 0,
                    }}
                  />
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background group-hover:block">
                    Week of {weekLabel(week.week_start)}: {week.count} completed
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 sm:gap-3.5">
            {weeks.map((week) => (
              <span
                key={week.week_start}
                className="flex-1 text-center font-mono text-[10.5px] text-[#9a9aa0]"
              >
                W{isoWeek(week.week_start)}
              </span>
            ))}
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Tasks completed per week, last 8 weeks</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.week_start}>
              <th scope="row">{weekLabel(week.week_start)}</th>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function OpenByStatus({
  counts,
}: {
  counts: Dashboard["open_by_status"];
}) {
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <Card title="Open by status">
      {total === 0 ? (
        <p className="text-[13px] text-muted-foreground">No open tasks.</p>
      ) : (
        <div
          aria-hidden
          className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]"
        >
          {counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <div
                key={c.status}
                title={`${STATUS_LABEL[c.status as TaskStatus]}: ${c.count}`}
                className={STATUS_DOT_CLASS[c.status as TaskStatus]}
                style={{ flex: c.count }}
              />
            ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {counts.map((c) => (
          <li
            key={c.status}
            className="flex items-center gap-1.5 text-xs text-[#55555b]"
          >
            <span
              aria-hidden
              className={cn(
                "size-[7px] rounded-full",
                STATUS_DOT_CLASS[c.status as TaskStatus],
              )}
            />
            {STATUS_LABEL[c.status as TaskStatus]}
            <b className="font-semibold text-foreground">{c.count}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function WorkloadChart({ members }: { members: Dashboard["workload"] }) {
  const max = Math.max(1, ...members.map((m) => m.open));
  return (
    <Card title="Workload" className="flex-1">
      {members.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No open tasks are assigned to anyone.
        </p>
      ) : (
        <ul className="grid gap-3">
          {members.map((member) => (
            <li
              key={member.user_id}
              className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2.5 text-[12.5px]"
            >
              <span className="truncate" title={member.name}>
                {member.name}
              </span>
              <span
                aria-hidden
                className="h-2 overflow-hidden rounded-[4px] bg-[#f2f2ef]"
                title={`${member.name}: ${member.open} open`}
              >
                <span
                  className="block h-full rounded-[4px] bg-primary"
                  style={{ width: `${(member.open / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono text-[11.5px] text-muted-foreground">
                {member.open}
                <span className="sr-only"> open tasks</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

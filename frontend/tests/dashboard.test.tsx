import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CompletedPerWeekChart,
  isoWeek,
  overdueChange,
  StatCards,
  WorkloadChart,
} from "@/components/dashboard/dashboard-charts";
import type { Schemas } from "@/lib/api/client";

const weeks = [
  ["2026-09-07", 3],
  ["2026-09-14", 0],
  ["2026-09-21", 5],
  ["2026-09-28", 2],
  ["2026-10-05", 0],
  ["2026-10-12", 1],
  ["2026-10-19", 4],
  ["2026-10-26", 6],
].map(([week_start, count]) => ({
  week_start: String(week_start),
  count: Number(count),
}));

const data: Schemas["DashboardOut"] = {
  today: "2026-10-30",
  project_id: null,
  open_total: 19,
  open_projects: 4,
  open_by_status: [
    { status: "todo", count: 11 },
    { status: "in_progress", count: 5 },
    { status: "in_review", count: 3 },
  ],
  overdue: 3,
  overdue_week_ago: 1,
  completed_this_week: 6,
  completed_per_week: weeks,
  workload: [
    { user_id: "u1", name: "Kurt Alvarez", open: 6 },
    { user_id: "u2", name: "Jen Santos", open: 2 },
  ],
  created_recently: 20,
  created_by_ai: 7,
};

describe("dashboard helpers", () => {
  it("numbers weeks the ISO way", () => {
    expect(isoWeek("2026-10-26")).toBe(44);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
  });

  it("describes the overdue change", () => {
    expect(overdueChange(3, 1)).toBe("2 more than last week");
    expect(overdueChange(1, 4)).toBe("3 fewer than last week");
    expect(overdueChange(2, 2)).toBe("same as last week");
  });
});

describe("dashboard cards and charts", () => {
  it("shows the four headline numbers", () => {
    render(<StatCards data={data} />);
    expect(screen.getByText("across 4 projects")).toBeInTheDocument();
    expect(screen.getByText("2 more than last week")).toBeInTheDocument();
    expect(screen.getByText("8-week avg 3")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
  });

  it("gives screen readers the weekly numbers as a table", () => {
    render(<CompletedPerWeekChart weeks={weeks} />);
    const table = screen.getByRole("table", {
      name: "Tasks completed per week, last 8 weeks",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(9);
  });

  it("says so when nothing was completed", () => {
    render(
      <CompletedPerWeekChart weeks={weeks.map((w) => ({ ...w, count: 0 }))} />,
    );
    expect(
      screen.getByText("Nothing completed in the last 8 weeks yet."),
    ).toBeInTheDocument();
  });

  it("lists workload per member with an empty state", () => {
    const { rerender } = render(<WorkloadChart members={data.workload} />);
    expect(screen.getByText("Kurt Alvarez")).toBeInTheDocument();
    rerender(<WorkloadChart members={[]} />);
    expect(
      screen.getByText("No open tasks are assigned to anyone."),
    ).toBeInTheDocument();
  });
});

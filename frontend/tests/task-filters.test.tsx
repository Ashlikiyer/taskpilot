import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/components/tasks/filter-bar";
import {
  EMPTY_FILTERS,
  nextSort,
  parseFilters,
  toApiQuery,
  writeFilters,
} from "@/lib/task-filters";

describe("task filter URL state", () => {
  it("round-trips through the URL and keeps unrelated params", () => {
    const filters = {
      ...EMPTY_FILTERS,
      q: "invoice",
      status: ["todo" as const, "done" as const],
      assignee: "u-mark",
      dueFrom: "2026-11-01",
      sort: { field: "due_date" as const, desc: true },
      page: 3,
    };

    const params = writeFilters(new URLSearchParams("task=t1"), filters);

    expect(params.get("task")).toBe("t1");
    expect(params.get("sort")).toBe("-due_date");
    expect(parseFilters(params)).toEqual(filters);
  });

  it("drops empty values so URLs stay short", () => {
    const params = writeFilters(
      new URLSearchParams("q=old&page=4"),
      EMPTY_FILTERS,
    );
    expect(params.toString()).toBe("");
  });

  it("ignores malformed values instead of failing", () => {
    const filters = parseFilters(
      new URLSearchParams(
        "status=todo,bogus&due_from=tomorrow&sort=password&page=-2",
      ),
    );
    expect(filters.status).toEqual(["todo"]);
    expect(filters.dueFrom).toBeNull();
    expect(filters.sort).toBeNull();
    expect(filters.page).toBe(1);
  });

  it("builds the backend query with repeated status params", () => {
    const query = new URLSearchParams(
      toApiQuery({
        ...EMPTY_FILTERS,
        status: ["todo", "in_review"],
        label: "l1",
      }),
    );
    expect(query.getAll("status")).toEqual(["todo", "in_review"]);
    expect(query.get("label")).toBe("l1");
    expect(query.get("sort")).toBe("position");
    expect(query.get("page_size")).toBe("25");
  });

  it("cycles sorting ascending, descending, then off", () => {
    const asc = nextSort(null, "title");
    const desc = nextSort(asc, "title");
    expect(asc).toEqual({ field: "title", desc: false });
    expect(desc).toEqual({ field: "title", desc: true });
    expect(nextSort(desc, "title")).toBeNull();
    expect(nextSort(desc, "priority")).toEqual({
      field: "priority",
      desc: false,
    });
  });
});

describe("FilterBar", () => {
  afterEach(() => vi.useRealTimers());

  it("waits for a pause in typing before searching, and resets to page 1", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <FilterBar
        filters={{ ...EMPTY_FILTERS, page: 4 }}
        onChange={onChange}
        members={[]}
        labels={[]}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "acme" },
    });
    act(() => vi.advanceTimersByTime(200));
    expect(onChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(150));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_FILTERS,
      q: "acme",
      page: 1,
    });
  });

  it("clears every filter but keeps the sort", () => {
    const onChange = vi.fn();
    const sort = { field: "title" as const, desc: false };
    render(
      <FilterBar
        filters={{
          ...EMPTY_FILTERS,
          priority: ["urgent"],
          dueTo: "2026-11-30",
          sort,
        }}
        onChange={onChange}
        members={[]}
        labels={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, sort });
  });

  it("hides Clear filters when nothing is filtered", () => {
    render(
      <FilterBar
        filters={EMPTY_FILTERS}
        onChange={vi.fn()}
        members={[]}
        labels={[]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
  });
});

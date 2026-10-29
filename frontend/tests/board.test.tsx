import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { taskKeys, useMoveTask } from "@/hooks/use-tasks";
import { setAccessToken } from "@/lib/api/client";
import {
  columnId,
  findColumn,
  moveToColumn,
  placement,
  positionBetween,
  reorder,
} from "@/lib/board";
import { groupByStatus, type Task } from "@/lib/tasks";

const task = (id: string, status: Task["status"], position: number): Task => ({
  id,
  project_id: "p1",
  parent_id: null,
  title: id.toUpperCase(),
  description: null,
  status,
  priority: "medium",
  assignee_id: null,
  due_date: null,
  position,
  created_by: "u1",
  completed_at: null,
  source: "manual",
  labels: [],
  subtask_count: 0,
  subtasks_done: 0,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
});

const tasks = [
  task("a", "todo", 1024),
  task("b", "todo", 2048),
  task("c", "todo", 3072),
  task("x", "in_progress", 1024),
];

describe("board helpers", () => {
  it("finds the column for a card or a column id", () => {
    const columns = groupByStatus(tasks);
    expect(findColumn(columns, "x")).toBe("in_progress");
    expect(findColumn(columns, columnId("done"))).toBe("done");
    expect(findColumn(columns, "missing")).toBeUndefined();
  });

  it("moves a card into another column before the card it's over", () => {
    const columns = moveToColumn(groupByStatus(tasks), "c", "x");
    expect(columns.todo.map((t) => t.id)).toEqual(["a", "b"]);
    expect(columns.in_progress.map((t) => t.id)).toEqual(["c", "x"]);
    expect(columns.in_progress[0].status).toBe("in_progress");
  });

  it("drops a card at the end of an empty column", () => {
    const columns = moveToColumn(groupByStatus(tasks), "a", columnId("done"));
    expect(columns.done.map((t) => t.id)).toEqual(["a"]);
  });

  it("reorders within a column and reports the new neighbours", () => {
    const columns = reorder(groupByStatus(tasks), "c", "b");
    expect(columns.todo.map((t) => t.id)).toEqual(["a", "c", "b"]);

    const spot = placement(columns, "c");
    expect(spot?.status).toBe("todo");
    expect(spot?.before?.id).toBe("a");
    expect(spot?.after?.id).toBe("b");
  });

  it("computes the same midpoint as the backend", () => {
    expect(positionBetween(tasks[0], tasks[1])).toBe(1536);
    expect(positionBetween(undefined, tasks[0])).toBe(0);
    expect(positionBetween(tasks[2], undefined)).toBe(4096);
    expect(positionBetween()).toBe(1024);
  });
});

describe("useMoveTask", () => {
  beforeEach(() => setAccessToken("token"));

  function setup() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(taskKeys.project("p1"), {
      items: tasks,
      total: tasks.length,
      page: 1,
      page_size: 100,
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMoveTask("p1"), { wrapper });
    const board = () =>
      client.getQueryData<{ items: Task[] }>(taskKeys.project("p1"))!.items;
    return { move: result.current, board };
  }

  it("updates the board immediately and sends the neighbours", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => new Promise((r) => (resolve = r)));
    const { move, board } = setup();

    act(() =>
      move(
        {
          task: tasks[2],
          status: "todo",
          before: tasks[0],
          after: tasks[1],
          position: 1536,
        },
        vi.fn(),
      ),
    );

    // Optimistic: C already sits between A and B before the server answers.
    expect(groupByStatus(board()).todo.map((t) => t.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/tasks/c/move");
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "todo",
      before_id: "a",
      after_id: "b",
    });
    resolve(new Response(JSON.stringify(tasks[2])));
  });

  it("rolls back and reports the error when the move fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "CONFLICT", message: "Project is archived" },
        }),
        { status: 409 },
      ),
    );
    const onError = vi.fn();
    const { move, board } = setup();

    act(() =>
      move({ task: tasks[0], status: "done", position: 1024 }, onError),
    );
    expect(board().find((t) => t.id === "a")?.status).toBe("done");

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(board().find((t) => t.id === "a")?.status).toBe("todo");
  });
});

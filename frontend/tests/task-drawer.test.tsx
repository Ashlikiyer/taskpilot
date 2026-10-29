import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskDrawer } from "@/components/tasks/task-drawer";
import { setAccessToken, type Schemas } from "@/lib/api/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/w/acme/p/p1",
  useSearchParams: () => new URLSearchParams("task=t1"),
}));

const workspace: Schemas["WorkspaceOut"] = {
  id: "ws1",
  name: "Acme",
  slug: "acme",
  owner_id: "u-olive",
  role: "owner",
  created_at: "2026-10-29T00:00:00Z",
};

const project: Schemas["ProjectOut"] = {
  id: "p1",
  workspace_id: "ws1",
  name: "Website",
  description: null,
  color: "#6366f1",
  archived_at: null,
  member_ids: ["u-olive"],
  created_at: "2026-10-29T00:00:00Z",
};

const baseTask = {
  project_id: "p1",
  description: null,
  priority: "medium",
  assignee_id: null,
  due_date: null,
  position: 1024,
  created_by: "u-olive",
  completed_at: null,
  source: "manual",
  labels: [],
  subtask_count: 0,
  subtasks_done: 0,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};

const parent = {
  ...baseTask,
  id: "t1",
  parent_id: null,
  title: "Launch site",
  status: "todo",
  subtask_count: 2,
  subtasks_done: 1,
};
const subtasks = [
  {
    ...baseTask,
    id: "s1",
    parent_id: "t1",
    title: "Write copy",
    status: "done",
  },
  {
    ...baseTask,
    id: "s2",
    parent_id: "t1",
    title: "Test forms",
    status: "todo",
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function mockApi() {
  const patches: { url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      patches.push({ url, body });
      return json({ ...subtasks[1], ...body });
    }
    if (url.endsWith("/auth/me")) {
      return json({
        id: "u-olive",
        name: "Olive",
        email: "o@example.com",
        avatar_url: null,
        timezone: "Asia/Manila",
      });
    }
    if (url.endsWith("/tasks/t1")) return json(parent);
    if (url.includes("parent_id=t1")) {
      return json({ items: subtasks, total: 2, page: 1, page_size: 100 });
    }
    if (url.endsWith("/tasks/t1/activity")) {
      return json([
        {
          id: "a1",
          task_id: "t1",
          actor_id: "u-olive",
          actor_name: "Olive",
          action: "created",
          field: null,
          old_value: null,
          new_value: "Launch site",
          created_at: new Date().toISOString(),
        },
      ]);
    }
    if (url.endsWith("/members")) return json([]);
    if (url.endsWith("/projects/p1")) return json(project);
    if (url.endsWith("/labels")) return json([]);
    return json({ error: { code: "NOT_FOUND", message: url } }, 404);
  });
  return patches;
}

/** Owners can edit; viewers get the read-only drawer. */
function renderDrawer(role: "owner" | "viewer") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaskDrawer workspace={{ ...workspace, role }} />
    </QueryClientProvider>,
  );
}

describe("TaskDrawer", () => {
  beforeEach(() => setAccessToken("token"));

  it("shows subtask progress and the activity history", async () => {
    mockApi();
    renderDrawer("owner");

    expect(await screen.findByText("1/2 done")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Subtask progress" }),
    ).toHaveAttribute("aria-valuenow", "50");
    expect(await screen.findByText("created this task")).toBeInTheDocument();
  });

  it("ticking a subtask marks it done", async () => {
    const patches = mockApi();
    renderDrawer("owner");

    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Test forms" }),
    );

    await waitFor(() =>
      expect(patches).toEqual([
        { url: "/api/v1/tasks/s2", body: { status: "done" } },
      ]),
    );
  });

  it("is read-only for people who can't edit", async () => {
    mockApi();
    renderDrawer("viewer");

    expect(
      await screen.findByRole("dialog", { name: "Launch site" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete task/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "New subtask title" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("checkbox", { name: "Test forms" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandMenu } from "@/components/command-menu";
import { setAccessToken, type Schemas } from "@/lib/api/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const workspace: Schemas["WorkspaceOut"] = {
  id: "ws1",
  name: "Acme",
  slug: "acme",
  owner_id: "u1",
  role: "member",
  created_at: "2026-10-29T00:00:00Z",
};

const project = {
  id: "p1",
  workspace_id: "ws1",
  name: "Acme Website",
  description: null,
  color: "#6366f1",
  archived_at: "2026-10-29T00:00:00Z",
  member_ids: [],
  created_at: "2026-10-29T00:00:00Z",
};

const task = {
  id: "t1",
  project_id: "p1",
  parent_id: null,
  title: "Send the Acme invoice",
  description: null,
  status: "todo",
  priority: "high",
  assignee_id: null,
  due_date: null,
  position: 1024,
  created_by: "u1",
  completed_at: null,
  source: "manual",
  labels: [],
  subtask_count: 0,
  subtasks_done: 0,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
};

function mockApi() {
  const searches: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/search?")) {
      searches.push(new URL(url, "http://x").searchParams.get("q") ?? "");
      return new Response(
        JSON.stringify({ projects: [project], tasks: [task] }),
      );
    }
    if (url.includes("/projects"))
      return new Response(JSON.stringify([project]));
    return new Response("{}", { status: 404 });
  });
  return searches;
}

function renderMenu() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CommandMenu workspace={workspace} />
    </QueryClientProvider>,
  );
}

describe("CommandMenu", () => {
  beforeEach(() => {
    setAccessToken("token");
    push.mockReset();
  });

  it("opens with Ctrl+K and shows a hint before typing", async () => {
    mockApi();
    renderMenu();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(
      await screen.findByRole("combobox", {
        name: "Search tasks and projects",
      }),
    ).toHaveFocus();
    expect(
      screen.getByText(
        "Type to search task titles, descriptions and project names.",
      ),
    ).toBeInTheDocument();
  });

  it("searches after a pause and opens a result with the keyboard", async () => {
    const searches = mockApi();
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    const input = await screen.findByRole("combobox");

    fireEvent.change(input, { target: { value: "acme" } });
    const options = await screen.findAllByRole("option");

    expect(searches).toEqual(["acme"]);
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveTextContent("Archived");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/w/acme/p/p1?task=t1"),
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("jumps to a project when it's picked", async () => {
    mockApi();
    renderMenu();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(await screen.findByRole("combobox"), {
      target: { value: "web" },
    });

    fireEvent.click((await screen.findAllByRole("option"))[0]);

    expect(push).toHaveBeenCalledWith("/w/acme/p/p1");
  });
});

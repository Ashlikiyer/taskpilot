import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { setAccessToken, type Schemas } from "@/lib/api/client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const workspace: Schemas["WorkspaceOut"] = {
  id: "ws1",
  name: "Acme",
  slug: "acme",
  owner_id: "u-olive",
  role: "owner",
  created_at: "2026-10-29T00:00:00Z",
};

const members = [
  {
    user_id: "u-olive",
    name: "Olive",
    email: "olive@example.com",
    avatar_url: null,
    role: "owner",
    joined_at: "2026-10-29T00:00:00Z",
  },
  {
    user_id: "u-mark",
    name: "Mark",
    email: "mark@example.com",
    avatar_url: null,
    role: "member",
    joined_at: "2026-10-29T00:00:00Z",
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function mockApi() {
  const posted: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return json({
        id: "u-olive",
        name: "Olive",
        email: "olive@example.com",
        avatar_url: null,
        timezone: "Asia/Manila",
      });
    }
    if (url.endsWith("/workspaces/ws1/members")) return json(members);
    if (url.endsWith("/workspaces/ws1/projects") && init?.method === "POST") {
      posted.push(JSON.parse(String(init.body)));
      return json(
        {
          id: "p1",
          workspace_id: "ws1",
          name: "Website",
          description: null,
          color: "#6366f1",
          archived_at: null,
          member_ids: ["u-olive"],
          created_at: "2026-10-29T00:00:00Z",
        },
        201,
      );
    }
    return json({ error: { code: "NOT_FOUND", message: url } }, 404);
  });
  return posted;
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectFormDialog workspace={workspace} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("ProjectFormDialog", () => {
  beforeEach(() => setAccessToken("token"));

  it("always includes the creator and can't untick them", async () => {
    mockApi();
    renderDialog();

    const creator = await screen.findByRole("checkbox", {
      name: "Olive (you)",
    });
    expect(creator).toBeChecked();
    expect(creator).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox", { name: "Mark" })).not.toBeChecked();
  });

  it("requires a name", async () => {
    const posted = mockApi();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Enter a project name")).toBeInTheDocument();
    expect(posted).toHaveLength(0);
  });

  it("submits the selected members and a null description, then opens the project", async () => {
    const posted = mockApi();
    renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Website" },
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Mark" }));
    fireEvent.click(screen.getByRole("radio", { name: "Green" }));
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/w/acme/p/p1"));
    expect(posted).toEqual([
      {
        name: "Website",
        description: null,
        color: "#22c55e",
        member_ids: ["u-mark"],
      },
    ]);
  });
});

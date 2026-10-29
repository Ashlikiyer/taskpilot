import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtaskBreakdown } from "@/components/ai/subtask-breakdown";
import { setAccessToken } from "@/lib/api/client";

const SUGGESTIONS = ["Draft the invoice", "Check totals", "Email it to Acme"];

function mockApi(suggestResponse: Response) {
  const created: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/ai/subtasks")) return suggestResponse;
    if (url.endsWith("/projects/p1/tasks") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      created.push(body);
      return new Response(
        JSON.stringify({
          id: `s${created.length}`,
          project_id: "p1",
          parent_id: "t1",
          ...body,
        }),
        { status: 201 },
      );
    }
    return new Response("{}");
  });
  return created;
}

function renderBreakdown() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SubtaskBreakdown taskId="t1" projectId="p1" />
    </QueryClientProvider>,
  );
}

describe("SubtaskBreakdown", () => {
  beforeEach(() => setAccessToken("token"));

  it("creates only the ticked suggestions, in order", async () => {
    const created = mockApi(
      new Response(JSON.stringify({ subtasks: SUGGESTIONS })),
    );
    renderBreakdown();

    fireEvent.click(screen.getByRole("button", { name: "Break down with AI" }));
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box).toBeChecked());

    fireEvent.click(screen.getByRole("checkbox", { name: "Check totals" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 2 subtasks" }));

    await waitFor(() =>
      expect(created).toEqual([
        { title: "Draft the invoice", parent_id: "t1" },
        { title: "Email it to Acme", parent_id: "t1" },
      ]),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Break down with AI" }),
      ).toBeInTheDocument(),
    );
  });

  it("cancelling adds nothing", async () => {
    const created = mockApi(
      new Response(JSON.stringify({ subtasks: SUGGESTIONS })),
    );
    renderBreakdown();

    fireEvent.click(screen.getByRole("button", { name: "Break down with AI" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(created).toEqual([]);
  });

  it("keeps the button available when the AI fails", async () => {
    mockApi(
      new Response(
        JSON.stringify({
          error: { code: "AI_UNAVAILABLE", message: "Try again" },
        }),
        { status: 502 },
      ),
    );
    renderBreakdown();

    fireEvent.click(screen.getByRole("button", { name: "Break down with AI" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Break down with AI" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

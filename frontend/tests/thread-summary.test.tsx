import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentThread } from "@/components/comments/comment-thread";
import { setAccessToken } from "@/lib/api/client";

const comment = (index: number) => ({
  id: `c${index}`,
  task_id: "t1",
  author_id: "u1",
  author_name: "Olive",
  body: `Comment ${index}`,
  edited_at: null,
  created_at: "2026-10-29T00:00:00Z",
});

function mockApi(commentCount: number) {
  const summaryCalls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/ai/summary")) {
      summaryCalls.push(url);
      return new Response(
        JSON.stringify({
          decisions: ["Bill the new rate"],
          open_questions: [],
          next_steps: ["Mark sends the invoice Friday"],
          generated_at: new Date().toISOString(),
          cached: false,
        }),
      );
    }
    if (url.endsWith("/comments")) {
      return new Response(
        JSON.stringify(
          Array.from({ length: commentCount }, (_, i) => comment(i + 1)),
        ),
      );
    }
    return new Response("{}");
  });
  return summaryCalls;
}

function renderThread(canUseAI = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CommentThread
        taskId="t1"
        members={[]}
        currentUserId="u1"
        canComment
        canUseAI={canUseAI}
      />
    </QueryClientProvider>,
  );
}

describe("thread summary", () => {
  beforeEach(() => setAccessToken("token"));

  it("is offered once a thread has more than 5 comments", async () => {
    mockApi(6);
    renderThread();

    expect(
      await screen.findByRole("button", { name: "Summarize" }),
    ).toBeInTheDocument();
  });

  it("isn't offered for 5 comments or fewer", async () => {
    mockApi(5);
    renderThread();

    await screen.findByText("Comment 5");
    expect(
      screen.queryByRole("button", { name: "Summarize" }),
    ).not.toBeInTheDocument();
  });

  it("isn't offered to viewers", async () => {
    mockApi(8);
    renderThread(false);

    await screen.findByText("Comment 8");
    expect(
      screen.queryByRole("button", { name: "Summarize" }),
    ).not.toBeInTheDocument();
  });

  it("shows decisions, open questions and next steps", async () => {
    const calls = mockApi(6);
    renderThread();

    fireEvent.click(await screen.findByRole("button", { name: "Summarize" }));

    const summary = await screen.findByRole("region", {
      name: /Thread summary/,
    });
    expect(summary).toHaveTextContent("Bill the new rate");
    expect(summary).toHaveTextContent("Mark sends the invoice Friday");
    expect(summary).toHaveTextContent("Open questionsNone");
    expect(calls).toEqual(["/api/v1/tasks/t1/ai/summary"]);
  });
});

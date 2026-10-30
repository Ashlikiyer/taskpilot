import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confidenceLabel,
  IntakeItemCard,
} from "@/components/intake/intake-item-card";
import { setAccessToken, type Schemas } from "@/lib/api/client";

const project: Schemas["ProjectOut"] = {
  id: "p1",
  workspace_id: "ws1",
  name: "Acme Website",
  description: null,
  color: "#6366f1",
  archived_at: null,
  member_ids: ["u-mark"],
  created_at: "2026-10-29T00:00:00Z",
  intake_email_label: "TaskPilot/Acme",
  intake_form_enabled: false,
  intake_slug: null,
  intake_pending: 1,
};

const item: Schemas["IntakeItemOut"] = {
  id: "i1",
  project_id: "p1",
  source: "email",
  raw_subject: "Contact form broken",
  raw_body: "<script>alert(1)</script> It errors on submit.",
  sender: "Ana Cruz <ana@acme.com>",
  draft: {
    title: "Fix the contact form",
    description: "Submitting shows an error.",
    assignee_id: null,
    project_id: "p1",
    due_date: "2026-10-31",
    priority: "high",
    labels: ["Website"],
    warnings: ["The sender didn't say which page."],
  },
  confidence: 0.3,
  status: "pending",
  task_id: null,
  created_at: new Date().toISOString(),
};

function mockApi() {
  const posts: { url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "POST") {
      posts.push({
        url: String(input),
        body: init.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({ ...item, status: "accepted", task_id: "t1" }),
      );
    }
    return new Response("[]");
  });
  return posts;
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <IntakeItemCard item={item} project={project} members={[]} labels={[]} />
    </QueryClientProvider>,
  );
}

describe("confidenceLabel", () => {
  it.each([
    [0.9, "High confidence"],
    [0.5, "Medium confidence"],
    [0.1, "Low confidence: please check"],
  ])("%s → %s", (value, text) => {
    expect(confidenceLabel(value).text).toBe(text);
  });
});

describe("IntakeItemCard", () => {
  beforeEach(() => setAccessToken("token"));

  it("shows the draft, confidence, warnings and the original as plain text", () => {
    mockApi();
    renderCard();

    expect(
      screen.getByRole("article", { name: "Fix the contact form" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Low confidence: please check (30%)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The sender didn't say which page."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/<script>alert\(1\)<\/script>/),
    ).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("accepts with one click", async () => {
    const posts = mockApi();
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() =>
      expect(posts).toEqual([{ url: "/api/v1/intake/i1/accept", body: {} }]),
    );
  });

  it("asks before rejecting", async () => {
    const posts = mockApi();
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(posts).toEqual([]);
    expect(screen.getByText("Reject this request?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(posts.map((p) => p.url)).toEqual(["/api/v1/intake/i1/reject"]),
    );
  });
});

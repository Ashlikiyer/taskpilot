import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DigestPage from "@/app/w/[slug]/digest/page";
import { setAccessToken, type Schemas } from "@/lib/api/client";
import { describeNotification, notificationHref } from "@/lib/notifications";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/w/acme/digest",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ slug: "acme" }),
}));

const workspace = {
  id: "ws1",
  name: "Acme",
  slug: "acme",
  owner_id: "u1",
  role: "member",
  created_at: "2026-10-29T00:00:00Z",
};

const item = (title: string, reason: string | null = null) => ({
  id: `t-${title}`,
  title,
  project_id: "p1",
  project_name: "Acme Website",
  status: "todo",
  priority: "high",
  due_date: "2026-10-29",
  reason,
});

function mockApi(digest: object) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/workspaces"))
      return new Response(JSON.stringify([workspace]));
    if (url.endsWith("/digest/today"))
      return new Response(JSON.stringify(digest));
    return new Response("[]");
  });
}

const digest = (content: object, summary: string | null) => ({
  id: "d1",
  workspace_id: "ws1",
  date: "2026-10-29",
  content: { overdue: [], due_today: [], at_risk: [], ...content },
  summary,
  created_at: "2026-10-29T00:00:00Z",
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DigestPage />
    </QueryClientProvider>,
  );
}

describe("Digest page", () => {
  beforeEach(() => setAccessToken("token"));

  it("shows the AI summary and the three groups", async () => {
    mockApi(
      digest(
        {
          overdue: [item("Send invoice")],
          due_today: [item("Call Acme")],
          at_risk: [
            item("Draft copy", "due_soon"),
            item("Migrate DNS", "stalled"),
          ],
        },
        "Morning! Start with the overdue invoice.",
      ),
    );
    renderPage();

    expect(
      await screen.findByRole("region", { name: "Summary" }),
    ).toHaveTextContent("Start with the overdue invoice.");
    expect(
      screen.getByRole("region", { name: "Overdue, 1 task" }),
    ).toHaveTextContent("Send invoice");
    expect(
      screen.getByRole("region", { name: "Due today, 1 task" }),
    ).toBeInTheDocument();
    const atRisk = screen.getByRole("region", { name: "At risk, 2 tasks" });
    expect(atRisk).toHaveTextContent("Due within 2 days and not started");
    expect(atRisk).toHaveTextContent("In progress, no activity for 5 days");
  });

  it("still shows the lists when the AI summary is missing", async () => {
    mockApi(digest({ due_today: [item("Call Acme")] }, null));
    renderPage();

    expect(await screen.findByText("Call Acme")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Summary" }),
    ).not.toBeInTheDocument();
  });

  it("says you're all caught up when there's nothing", async () => {
    mockApi(digest({}, null));
    renderPage();

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});

describe("digest notifications", () => {
  const note: Schemas["NotificationOut"] = {
    id: "n1",
    type: "digest",
    task_id: null,
    payload: {
      workspace_slug: "acme",
      workspace_name: "Acme",
      date: "2026-10-29",
      overdue: 1,
      due_today: 0,
      at_risk: 2,
    },
    read_at: null,
    created_at: "2026-10-29T00:00:00Z",
  };

  it("summarizes the counts and links to the digest page", () => {
    expect(describeNotification(note)).toEqual({
      title: "Your daily digest for Acme",
      detail: "1 overdue · 2 tasks at risk",
    });
    expect(notificationHref(note)).toBe("/w/acme/digest");
  });
});

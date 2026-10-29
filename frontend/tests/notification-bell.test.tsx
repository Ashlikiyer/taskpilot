import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/notification-bell";
import { setAccessToken, type Schemas } from "@/lib/api/client";
import { describeNotification, notificationHref } from "@/lib/notifications";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const notification = (
  overrides: Partial<Schemas["NotificationOut"]>,
): Schemas["NotificationOut"] => ({
  id: "n1",
  type: "assigned",
  task_id: "t1",
  payload: {
    task_title: "Send the Acme invoice",
    project_id: "p1",
    workspace_slug: "acme",
    actor_name: "Olive",
  },
  read_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

const inbox = [
  notification({
    id: "n1",
    type: "mentioned",
    payload: {
      task_title: "Send the Acme invoice",
      project_id: "p1",
      workspace_slug: "acme",
      actor_name: "Mark",
      excerpt: "@Olive can you check?",
    },
  }),
  notification({ id: "n2", read_at: "2026-10-29T00:00:00Z" }),
];

function mockApi() {
  const posts: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      posts.push(url);
      return url.endsWith("read-all")
        ? new Response(null, { status: 204 })
        : new Response(
            JSON.stringify({ ...inbox[0], read_at: "2026-10-29T01:00:00Z" }),
          );
    }
    return new Response(JSON.stringify({ items: inbox, unread_count: 1 }));
  });
  return posts;
}

function renderBell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

describe("describeNotification", () => {
  it.each([
    ["assigned", 'Olive assigned you "Send the Acme invoice"'],
    ["comment", 'Olive commented on "Send the Acme invoice"'],
    ["due_tomorrow", '"Send the Acme invoice" is due tomorrow'],
  ])("%s", (type, title) => {
    expect(describeNotification(notification({ type })).title).toBe(title);
  });

  it("links to the task drawer on its project board", () => {
    expect(notificationHref(notification({}))).toBe("/w/acme/p/p1?task=t1");
    expect(notificationHref(notification({ task_id: null }))).toBeNull();
  });
});

describe("NotificationBell", () => {
  beforeEach(() => {
    setAccessToken("token");
    push.mockReset();
  });

  it("shows the unread count to everyone, including screen readers", async () => {
    mockApi();
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications, 1 unread" }),
    ).toBeInTheDocument();
  });

  it("opening a notification marks it read and goes to the task", async () => {
    const posts = mockApi();
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /1 unread/ }));

    const item = await screen.findByRole("menuitem", {
      name: /Mark mentioned you/,
    });
    expect(item).toHaveTextContent("@Olive can you check?");
    fireEvent.click(item);

    await waitFor(() =>
      expect(posts).toEqual(["/api/v1/notifications/n1/read"]),
    );
    expect(push).toHaveBeenCalledWith("/w/acme/p/p1?task=t1");
  });

  it("marks everything read", async () => {
    const posts = mockApi();
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /1 unread/ }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Mark all read" }),
    );

    await waitFor(() =>
      expect(posts).toEqual(["/api/v1/notifications/read-all"]),
    );
  });
});

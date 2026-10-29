import { describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/client";
import {
  assignableMembers,
  canDeleteTask,
  canEditTasks,
  describeActivity,
  groupByStatus,
  timeAgo,
  type Task,
} from "@/lib/tasks";

const workspace = (role: Schemas["MemberRole"]): Schemas["WorkspaceOut"] => ({
  id: "ws1",
  name: "Acme",
  slug: "acme",
  owner_id: "u-olive",
  role,
  created_at: "2026-10-29T00:00:00Z",
});

const project = (
  overrides: Partial<Schemas["ProjectOut"]> = {},
): Schemas["ProjectOut"] => ({
  id: "p1",
  workspace_id: "ws1",
  name: "Website",
  description: null,
  color: "#6366f1",
  archived_at: null,
  member_ids: ["u-mark"],
  created_at: "2026-10-29T00:00:00Z",
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  project_id: "p1",
  parent_id: null,
  title: "Task",
  description: null,
  status: "todo",
  priority: "medium",
  assignee_id: null,
  due_date: null,
  position: 1024,
  created_by: "u-mark",
  completed_at: null,
  source: "manual",
  labels: [],
  subtask_count: 0,
  subtasks_done: 0,
  created_at: "2026-10-29T00:00:00Z",
  updated_at: "2026-10-29T00:00:00Z",
  ...overrides,
});

const entry = (
  overrides: Partial<Schemas["ActivityOut"]>,
): Schemas["ActivityOut"] => ({
  id: "a1",
  task_id: "t1",
  actor_id: "u-olive",
  actor_name: "Olive",
  action: "updated",
  field: null,
  old_value: null,
  new_value: null,
  created_at: "2026-10-29T00:00:00Z",
  ...overrides,
});

describe("task permissions", () => {
  it("lets admins edit any project and members only their own projects", () => {
    expect(canEditTasks(workspace("admin"), project(), "u-ada")).toBe(true);
    expect(canEditTasks(workspace("member"), project(), "u-mark")).toBe(true);
    expect(canEditTasks(workspace("member"), project(), "u-nina")).toBe(false);
    expect(canEditTasks(workspace("viewer"), project(), "u-mark")).toBe(false);
  });

  it("makes archived projects read-only for everyone", () => {
    const archived = project({ archived_at: "2026-10-29T00:00:00Z" });
    expect(canEditTasks(workspace("owner"), archived, "u-olive")).toBe(false);
  });

  it("lets members delete only tasks they created", () => {
    expect(canDeleteTask(workspace("member"), task(), "u-mark")).toBe(true);
    expect(canDeleteTask(workspace("member"), task(), "u-nina")).toBe(false);
    expect(canDeleteTask(workspace("admin"), task(), "u-ada")).toBe(true);
  });

  it("only offers assignees who can work on the project", () => {
    const member = (user_id: string, role: Schemas["MemberRole"]) => ({
      user_id,
      name: user_id,
      email: `${user_id}@example.com`,
      avatar_url: null,
      role,
      joined_at: "2026-10-29T00:00:00Z",
    });
    const members = [
      member("u-olive", "owner"),
      member("u-mark", "member"),
      member("u-nina", "member"),
      member("u-vic", "viewer"),
    ];

    expect(assignableMembers(members, project()).map((m) => m.user_id)).toEqual(
      ["u-olive", "u-mark"],
    );
  });
});

describe("groupByStatus", () => {
  it("groups into every column in position order", () => {
    const groups = groupByStatus([
      task({ id: "b", position: 2048 }),
      task({ id: "a", position: 1024 }),
      task({ id: "d", status: "done" }),
    ]);

    expect(groups.todo.map((t) => t.id)).toEqual(["a", "b"]);
    expect(groups.done.map((t) => t.id)).toEqual(["d"]);
    expect(groups.in_progress).toEqual([]);
  });
});

describe("describeActivity", () => {
  const names = { "u-mark": "Mark" };

  it.each([
    [entry({ action: "created", new_value: "Task" }), "created this task"],
    [
      entry({ field: "priority", old_value: "medium", new_value: "urgent" }),
      "changed the priority from Medium to Urgent",
    ],
    [
      entry({ field: "status", old_value: "todo", new_value: "in_review" }),
      "changed the status from To do to In review",
    ],
    [
      entry({ field: "assignee_id", new_value: "u-mark" }),
      "set the assignee to Mark",
    ],
    [
      entry({ field: "assignee_id", old_value: "u-mark" }),
      "cleared the assignee",
    ],
    [
      entry({ field: "due_date", new_value: "2026-11-03" }),
      "set the due date to Tue, Nov 3",
    ],
    [
      entry({ field: "description", old_value: "a", new_value: "b" }),
      "edited the description",
    ],
    [
      entry({ field: "title", old_value: "Old", new_value: "New" }),
      'changed the title from "Old" to "New"',
    ],
  ])("%#", (activity, text) => {
    expect(describeActivity(activity, names)).toBe(text);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  it("uses friendly relative times", () => {
    expect(timeAgo("2026-10-29T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-29T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-10-28T12:00:00Z", now)).toBe("yesterday");
  });
});

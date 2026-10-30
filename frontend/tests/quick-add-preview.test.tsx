import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickAddPreview } from "@/components/ai/quick-add-preview";
import type { Schemas } from "@/lib/api/client";

const project = (
  id: string,
  name: string,
  member_ids: string[],
): Schemas["ProjectOut"] => ({
  id,
  workspace_id: "ws1",
  name,
  description: null,
  color: "#6366f1",
  archived_at: null,
  member_ids,
  intake_email_label: null,
  intake_form_enabled: false,
  intake_slug: null,
  intake_pending: 0,
  created_at: "2026-10-29T00:00:00Z",
});

const member = (
  user_id: string,
  name: string,
  role: Schemas["MemberRole"],
): Schemas["MemberOut"] => ({
  user_id,
  name,
  email: `${user_id}@example.com`,
  avatar_url: null,
  role,
  joined_at: "2026-10-29T00:00:00Z",
});

const projects = [
  project("p-web", "Website", ["u-mark"]),
  project("p-ops", "Ops", []),
];
const members = [
  member("u-olive", "Olive", "owner"),
  member("u-mark", "Mark", "member"),
];
const labels = [
  { id: "l-billing", name: "Billing", color: "#64748b" },
  { id: "l-client", name: "Client", color: "#ef4444" },
];

function renderPreview(draft: Schemas["QuickAddDraft"], onConfirm = vi.fn()) {
  render(
    <QuickAddPreview
      draft={draft}
      projects={projects}
      members={members}
      labels={labels}
      saving={false}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return onConfirm;
}

describe("QuickAddPreview", () => {
  it("shows the AI's warnings so the user can check them", () => {
    renderPreview({
      title: "Send invoice",
      warnings: [
        "Couldn't match the assignee to a workspace member, so it's unassigned.",
      ],
    });

    expect(screen.getByText("Please check")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't match the assignee/)).toBeInTheDocument();
  });

  it("creates the edited task with label ids and the ai_quick_add source", () => {
    const onConfirm = renderPreview({
      title: "Send the Acme invoice",
      project_id: "p-web",
      assignee_id: "u-mark",
      due_date: "2026-10-31",
      priority: "high",
      labels: ["Billing"],
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Send the Acme invoice today " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(onConfirm).toHaveBeenCalledWith({
      projectId: "p-web",
      task: {
        title: "Send the Acme invoice today",
        description: null,
        assignee_id: "u-mark",
        due_date: "2026-10-31",
        priority: "high",
        label_ids: ["l-billing", "l-client"],
        source: "ai_quick_add",
      },
    });
  });

  it("asks for a project when the AI couldn't pick one", () => {
    const onConfirm = renderPreview({ title: "Call the bank" });

    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a project");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks an assignee who isn't on the chosen project", () => {
    const onConfirm = renderPreview({
      title: "Restart server",
      project_id: "p-ops",
      assignee_id: "u-mark",
    });

    expect(screen.getByText("Not on this project.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "isn't on this project",
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

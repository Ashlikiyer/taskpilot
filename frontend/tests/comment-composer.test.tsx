import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentComposer } from "@/components/comments/comment-composer";
import type { Schemas } from "@/lib/api/client";

const member = (user_id: string, name: string): Schemas["MemberOut"] => ({
  user_id,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  avatar_url: null,
  role: "member",
  joined_at: "2026-10-29T00:00:00Z",
});

const MARK = "11111111-1111-1111-1111-111111111111";
const MARIA = "22222222-2222-2222-2222-222222222222";
const members = [
  member(MARK, "Mark Santos"),
  member(MARIA, "Maria Cruz"),
  member("u3", "Olive"),
];

function type(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
}

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <CommentComposer
      label="New comment"
      members={members}
      onSubmit={onSubmit}
    />,
  );
  return {
    textarea: screen.getByRole("textbox", { name: "New comment" }),
    onSubmit,
  };
}

describe("CommentComposer", () => {
  it("suggests matching members after @", () => {
    const { textarea } = setup();

    type(textarea, "Thanks @mar");

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Mark Santosmark@example.com",
      "Maria Cruzmaria@example.com",
    ]);
    expect(textarea).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("picks a member with the arrow keys and Enter", () => {
    const { textarea } = setup();
    type(textarea, "Thanks @mar");

    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(textarea).toHaveValue(`Thanks @[Maria Cruz](${MARIA}) `);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the suggestions with Escape", () => {
    const { textarea } = setup();
    type(textarea, "@ol");

    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("sends with Ctrl+Enter and clears the box", async () => {
    const { textarea, onSubmit } = setup();
    type(textarea, "  Ship it  ");

    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Ship it"));
    await waitFor(() => expect(textarea).toHaveValue(""));
  });

  it("keeps the text when sending fails", async () => {
    const { textarea, onSubmit } = setup(
      vi.fn().mockRejectedValue(new Error("nope")),
    );
    type(textarea, "Important note");

    fireEvent.click(screen.getByRole("button", { name: "Comment" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(textarea).toHaveValue("Important note");
  });
});

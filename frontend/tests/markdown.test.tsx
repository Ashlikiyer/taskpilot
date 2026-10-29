import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "@/components/markdown";
import {
  activeMentionQuery,
  insertMention,
  mentionToken,
} from "@/lib/mentions";

const MARK = "11111111-1111-1111-1111-111111111111";

describe("Markdown", () => {
  it("renders formatting, lists and links that open in a new tab", () => {
    render(
      <Markdown>
        {
          "**Ship it**\n\n- [x] copy\n- [ ] photos\n\n[docs](https://example.com)"
        }
      </Markdown>,
    );

    expect(screen.getByText("Ship it").tagName).toBe("STRONG");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("shows mentions as chips, not links", () => {
    render(
      <Markdown>{`Thanks ${mentionToken("Mark Santos", MARK)}!`}</Markdown>,
    );

    const chip = screen.getByText("@Mark Santos");
    expect(chip.tagName).toBe("SPAN");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("drops raw HTML, javascript: links and images", () => {
    const { container } = render(
      <Markdown>
        {
          '<script>alert(1)</script><b onclick="x()">bold</b>\n\n[click](javascript:alert(1)) ![pixel](https://tracker.example/p.gif)'
        }
      </Markdown>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("click").closest("a")?.getAttribute("href")).toBe(
      "",
    );
  });
});

describe("mention helpers", () => {
  it("detects an @query being typed at the caret", () => {
    expect(activeMentionQuery("Hi @ma", 6)).toEqual({ start: 3, query: "ma" });
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(activeMentionQuery("email me@example.com", 20)).toBeNull();
    expect(activeMentionQuery("Hi @mark ", 9)).toBeNull();
  });

  it("replaces the @query with a mention token", () => {
    const result = insertMention("Hi @ma please", 3, 6, "Mark Santos", MARK);
    expect(result.text).toBe(`Hi @[Mark Santos](${MARK})  please`);
    expect(result.caret).toBe(3 + `@[Mark Santos](${MARK}) `.length);
  });

  it("strips characters that would break the token", () => {
    expect(mentionToken("We]ird\nName", MARK)).toBe(`@[WeirdName](${MARK})`);
  });
});

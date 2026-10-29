import { describe, expect, it } from "vitest";

import { safeRedirect } from "@/lib/safe-redirect";

describe("safeRedirect", () => {
  it.each([
    ["/w/acme", "/w/acme"],
    ["/invite/abc?x=1", "/invite/abc?x=1"],
    [null, "/w"],
    ["", "/w"],
    ["https://evil.example", "/w"],
    ["//evil.example", "/w"],
    ["/\\evil.example", "/w"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});

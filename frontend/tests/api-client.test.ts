import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, setAccessToken } from "@/lib/api/client";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const expired = () =>
  json(401, {
    error: {
      code: "TOKEN_EXPIRED",
      message: "Access token has expired",
      details: null,
    },
  });

function authHeader(call: unknown[]) {
  const init = call[1] as RequestInit | undefined;
  return new Headers(init?.headers).get("Authorization");
}

describe("api client", () => {
  beforeEach(() => setAccessToken("old-token"));

  it("sends the access token as a bearer header", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(json(200, { ok: true }));

    await api.get("/auth/me");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/me",
      expect.anything(),
    );
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer old-token");
  });

  it("refreshes once on TOKEN_EXPIRED and retries with the new token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(
        json(200, {
          access_token: "new-token",
          token_type: "bearer",
          expires_in: 900,
        }),
      )
      .mockResolvedValueOnce(json(200, { name: "Ana" }));

    await expect(api.get("/auth/me")).resolves.toEqual({ name: "Ana" });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
    ]);
    expect(authHeader(fetchMock.mock.calls[2])).toBe("Bearer new-token");
  });

  it("gives up after one failed refresh and surfaces the 401", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(
        json(401, {
          error: { code: "UNAUTHENTICATED", message: "Session expired" },
        }),
      );

    const error = await api.get("/auth/me").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("TOKEN_EXPIRED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on other 401 errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      json(401, {
        error: { code: "UNAUTHENTICATED", message: "Not authenticated" },
      }),
    );

    await expect(api.get("/auth/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares a single refresh between concurrent expired requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (input === "/api/v1/auth/refresh") {
          return json(200, {
            access_token: "new-token",
            token_type: "bearer",
            expires_in: 900,
          });
        }
        const auth = new Headers(init?.headers).get("Authorization");
        return auth === "Bearer new-token"
          ? json(200, { ok: true })
          : expired();
      });

    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

    const refreshes = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/v1/auth/refresh",
    );
    expect(refreshes).toHaveLength(1);
  });

  it("restores the session from the refresh cookie when no token is in memory", async () => {
    setAccessToken(null);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        json(200, {
          access_token: "fresh",
          token_type: "bearer",
          expires_in: 900,
        }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));

    await api.get("/workspaces");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/refresh");
    expect(authHeader(fetchMock.mock.calls[1])).toBe("Bearer fresh");
  });

  it("parses the backend error format into ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json(409, {
        error: { code: "CONFLICT", message: "Already a member", details: null },
      }),
    );

    await expect(
      api.post("/workspaces/x/invites", { email: "a@b.co" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Already a member",
    });
  });
});

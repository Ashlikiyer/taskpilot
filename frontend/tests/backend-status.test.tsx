import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BackendStatus } from "@/components/backend-status";

function renderWithQuery() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BackendStatus />
    </QueryClientProvider>,
  );
}

function mockFetch(status: number, body: unknown) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("BackendStatus", () => {
  it("shows online when the backend and database are healthy", async () => {
    mockFetch(200, { status: "ok", database: "ok" });
    renderWithQuery();

    expect(await screen.findByText("Backend online")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/health");
  });

  it("shows a database warning on a degraded 503 response", async () => {
    mockFetch(503, { status: "degraded", database: "unavailable" });
    renderWithQuery();

    expect(
      await screen.findByText("Backend online, database unavailable"),
    ).toBeInTheDocument();
  });

  it("shows unreachable when the request fails", async () => {
    mockFetch(502, { error: "bad gateway" });
    renderWithQuery();

    expect(await screen.findByText("Backend unreachable")).toBeInTheDocument();
  });
});

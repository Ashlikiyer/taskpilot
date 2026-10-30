import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublicIntakeForm } from "@/components/intake/public-intake-form";

function mockApi(infoStatus = 200) {
  const posts: { url: string; body: unknown; auth: string | null }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "POST") {
      posts.push({
        url: String(input),
        body: JSON.parse(String(init.body)),
        auth: new Headers(init.headers).get("Authorization"),
      });
      return new Response(JSON.stringify({ received: true }), { status: 202 });
    }
    return infoStatus === 200
      ? new Response(
          JSON.stringify({
            project_name: "Acme Website",
            workspace_name: "Acme",
          }),
        )
      : new Response(
          JSON.stringify({
            error: { code: "INTAKE_FORM_NOT_FOUND", message: "x" },
          }),
          { status: infoStatus },
        );
  });
  return posts;
}

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PublicIntakeForm slug="acme-website-k3x9q2" />
    </QueryClientProvider>,
  );
}

describe("PublicIntakeForm", () => {
  it("validates before sending", async () => {
    const posts = mockApi();
    renderForm();

    fireEvent.click(
      await screen.findByRole("button", { name: "Send request" }),
    );

    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Say briefly what you need")).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it("sends the request without a login and confirms it", async () => {
    const posts = mockApi();
    renderForm();

    expect(
      await screen.findByRole("heading", {
        name: "Send a request to Acme Website",
      }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Ana Cruz" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ana@acme.com" },
    });
    fireEvent.change(screen.getByLabelText("What do you need?"), {
      target: { value: "Fix the contact form" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Request received",
    );
    expect(posts).toEqual([
      {
        url: "/api/v1/intake/form/acme-website-k3x9q2",
        body: {
          name: "Ana Cruz",
          email: "ana@acme.com",
          title: "Fix the contact form",
          details: "",
          website: "",
        },
        auth: null,
      },
    ]);
  });

  it("hides the honeypot from people and screen readers", async () => {
    mockApi();
    renderForm();
    await screen.findByRole("button", { name: "Send request" });

    const trap = document.getElementById("intake-website");
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap?.closest("[aria-hidden]")).not.toBeNull();
    expect(
      screen.queryByRole("textbox", { name: "Website" }),
    ).not.toBeInTheDocument();
  });

  it("explains when the form is turned off", async () => {
    mockApi(404);
    renderForm();

    await waitFor(() =>
      expect(screen.getByText("This form isn't available")).toBeInTheDocument(),
    );
  });
});

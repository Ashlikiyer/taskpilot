import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import {
  CaptureSection,
  Faq,
  HeroSignup,
  Pricing,
} from "@/components/landing/landing-interactive";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("landing page", () => {
  it("carries the hero email over to sign-up", () => {
    render(<HeroSignup />);
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "ana@acme.ph" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start free" }));
    expect(push).toHaveBeenCalledWith("/register?email=ana%40acme.ph");
  });

  it("switches the demo panel with the capture tabs", () => {
    render(<CaptureSection />);
    expect(screen.getByText("Send Acme invoice")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Emails become proposals" }),
    );
    expect(
      screen.getByRole("button", { name: "Emails become proposals" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Reissue October invoice with PO #4471-B"),
    ).toBeInTheDocument();
  });

  it("shows yearly prices when Annually is picked", () => {
    render(<Pricing />);
    expect(screen.getByText("$10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annually" }));
    expect(screen.getByText("$8")).toBeInTheDocument();
    expect(screen.queryByText("$10")).not.toBeInTheDocument();
  });

  it("opens one FAQ answer at a time", () => {
    render(<Faq />);
    const question = screen.getByRole("button", {
      name: /Is there a limit on AI usage/,
    });
    expect(question).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /What is TaskPilot/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("pre-fills the sign-in form for the demo account", () => {
    render(
      <AuthForm
        mode="login"
        onSubmit={vi.fn()}
        defaults={{ email: "demo@taskpilot.dev", password: "taskpilot-demo" }}
      />,
    );
    expect(screen.getByLabelText("Email")).toHaveValue("demo@taskpilot.dev");
    expect(screen.getByLabelText("Password")).toHaveValue("taskpilot-demo");
  });
});

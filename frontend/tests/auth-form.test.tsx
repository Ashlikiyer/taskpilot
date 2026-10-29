import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("AuthForm", () => {
  it("validates register fields before submitting", async () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="register" onSubmit={onSubmit} />);

    fill("Email", "not-an-email");
    fill("Password", "short");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid login values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AuthForm mode="login" onSubmit={onSubmit} />);

    fill("Email", "ana@example.com");
    fill("Password", "whatever-password");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "ana@example.com",
        password: "whatever-password",
      }),
    );
  });

  it("shows the server error message", () => {
    render(
      <AuthForm
        mode="login"
        onSubmit={vi.fn()}
        error="Invalid email or password"
      />,
    );

    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
  });
});

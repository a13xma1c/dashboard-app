import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/LoginPage";
import { renderWithProviders } from "@tests/helpers/render";

describe("LoginPage", () => {
  it("shows Google sign-in copy in real mode and calls login", async () => {
    const login = vi.fn(async () => {});
    renderWithProviders(<LoginPage />, { auth: { authenticated: false, mockMode: false, login } });
    expect(screen.getByText(/Sign in with Google to connect/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Sign in with Google/ }));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("shows demo copy in mock mode", () => {
    renderWithProviders(<LoginPage />, { auth: { authenticated: false, mockMode: true } });
    expect(screen.getByText(/Demo mode is on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue with demo data/ })).toBeInTheDocument();
  });

  it("surfaces an OAuth error from the query string", () => {
    renderWithProviders(<LoginPage />, { route: "/?error=access_denied", auth: { authenticated: false } });
    expect(screen.getByRole("alert")).toHaveTextContent("access_denied");
  });

  it("disables the button while signing in", async () => {
    let resolve!: () => void;
    const login = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    renderWithProviders(<LoginPage />, { auth: { authenticated: false, login } });
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(button).toBeDisabled();
    resolve();
    await waitFor(() => expect(button).toBeEnabled());
  });
});

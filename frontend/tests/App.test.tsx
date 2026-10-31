import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import App from "@/App";
import { AuthProvider } from "@/context/AuthProvider";
import { createTestQueryClient } from "@tests/helpers/render";
import { checkAuth, mockApi, resetMockAnalytics } from "@tests/helpers/mockAnalytics";
import { PROPERTY_STORAGE_KEY } from "@/lib/storage";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

function renderApp(route: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => resetMockAnalytics());

describe("App routing", () => {
  it("shows a loading screen while auth is unknown", () => {
    checkAuth.mockReturnValueOnce(new Promise(() => {}));
    renderApp("/");
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows the login page when logged out and redirects protected routes", async () => {
    renderApp("/dashboard/audience");
    await waitFor(() => expect(screen.getByRole("button", { name: /Continue with demo data/ })).toBeInTheDocument());
  });

  it("redirects / to the overview when logged in", async () => {
    await mockApi.login();
    localStorage.setItem(PROPERTY_STORAGE_KEY, "123");
    renderApp("/");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Overview"));
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("renders nested dashboard pages", async () => {
    await mockApi.login();
    localStorage.setItem(PROPERTY_STORAGE_KEY, "123");
    renderApp("/dashboard/geography");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Geography"));
    expect(screen.getByText(/Where in the world/)).toBeInTheDocument();
  });

  it("redirects unknown dashboard paths to the overview", async () => {
    await mockApi.login();
    renderApp("/dashboard/nope");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Overview"));
  });

  it("redirects unknown top-level paths to /", async () => {
    renderApp("/what");
    await waitFor(() => expect(screen.getByText(/Demo mode is on/)).toBeInTheDocument());
  });
});

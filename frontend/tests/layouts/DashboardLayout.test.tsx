import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import { NAV_ITEMS } from "@/layouts/nav";
import { renderWithProviders } from "@tests/helpers/render";

function renderLayout(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="overview" element={<div>Overview content</div>} />
        <Route path="audience" element={<div>Audience content</div>} />
      </Route>
    </Routes>,
    { route: "/dashboard/overview", path: "*", ...options }
  );
}

describe("DashboardLayout", () => {
  it("renders navigation for every dashboard and highlights the current one", () => {
    renderLayout();
    const nav = screen.getByRole("navigation", { name: "Dashboards" });
    for (const item of NAV_ITEMS) expect(within(nav).getByRole("link", { name: item.label })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Overview");
  });

  it("navigates between pages and updates the title", async () => {
    renderLayout();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Audience" }));
    expect(screen.getByText("Audience content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Audience");
  });

  it("shows the empty state until a property is entered, then the page", async () => {
    renderLayout({ propertyId: "" });
    expect(screen.getByText("Connect a GA4 property")).toBeInTheDocument();
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
    expect(screen.getByText(/In demo mode any number works/)).toBeInTheDocument();

    const inputs = screen.getAllByLabelText("GA4 Property ID");
    await userEvent.type(inputs[inputs.length - 1], "42{Enter}");
    expect(screen.getByText("Overview content")).toBeInTheDocument();
    expect(screen.getByText("Property 42")).toBeInTheDocument();
  });

  it("shows demo badge, email and signs out", async () => {
    const logout = vi.fn(async () => {});
    renderLayout({ auth: { logout, email: "me@example.com", mockMode: true } });
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("hides the demo badge in real mode", () => {
    renderLayout({ auth: { mockMode: false, email: null } });
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
    expect(screen.queryByText(/In demo mode/)).not.toBeInTheDocument();
  });

  it("exposes the date range picker in the header", async () => {
    renderLayout({ dateRange: { start: "6daysAgo", end: "today" } });
    await userEvent.click(screen.getByRole("button", { name: /Last 7 days/ }));
    await userEvent.click(screen.getByRole("button", { name: "Last 90 days" }));
    expect(screen.getByRole("button", { name: /Last 90 days/ })).toBeInTheDocument();
  });
});

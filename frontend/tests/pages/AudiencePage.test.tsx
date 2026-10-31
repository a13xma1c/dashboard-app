import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AudiencePage from "@/pages/AudiencePage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchReport, resetMockAnalytics } from "@tests/helpers/mockAnalytics";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

describe("AudiencePage", () => {
  it("renders all widgets", async () => {
    renderWithProviders(<AudiencePage />);
    for (const name of ["Devices", "New vs returning", "Browsers", "Operating systems", "Sessions by hour of day", "Users over time"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByRole("region", { name: "Devices" }).querySelectorAll(".recharts-pie-sector")).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole("region", { name: "Browsers" }).querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(3));
    await waitFor(() => expect(screen.getByRole("region", { name: "Sessions by hour of day" }).querySelectorAll(".recharts-bar-rectangle")).toHaveLength(24));
    expect(screen.getByText("12am")).toBeInTheDocument();
  });

  it("cross-filters other widgets when a device is selected", async () => {
    renderWithProviders(<AudiencePage />);
    const devices = screen.getByRole("region", { name: "Devices" });
    await waitFor(() => expect(devices.querySelectorAll(".recharts-pie-sector")).toHaveLength(3));

    fetchReport.mockClear();
    fireEvent.click(devices.querySelectorAll(".recharts-pie-sector")[1]);

    const pill = await screen.findByText(/Device: /);
    const value = pill.textContent!.replace("Device: ", "").replace("×", "").trim();
    const filter = { dimension: "deviceCategory", value };

    await waitFor(() => expect(fetchReport).toHaveBeenCalledWith("browsers", expect.objectContaining({ filter })));
    expect(fetchReport).toHaveBeenCalledWith("hourly", expect.objectContaining({ filter }));
    expect(fetchReport).toHaveBeenCalledWith("overview", expect.objectContaining({ filter }));
    // The devices pie owns the filter, so it keeps its unfiltered query and isn't refetched.
    expect(fetchReport).not.toHaveBeenCalledWith("devices", expect.anything());

    // Clicking a browser bar moves the filter to the browser dimension.
    const browsers = screen.getByRole("region", { name: "Browsers" });
    await waitFor(() => expect(browsers.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0));
    fireEvent.click(browsers.querySelectorAll(".recharts-bar-rectangle")[0]);
    await screen.findByText(/Browser: /);
    expect(screen.queryByText(/Device: /)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.queryByText(/Browser: /)).not.toBeInTheDocument();
  });
});

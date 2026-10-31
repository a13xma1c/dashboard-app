import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "@/pages/OverviewPage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchReport, fetchSummary, resetMockAnalytics } from "@tests/helpers/mockAnalytics";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

const trendRegion = () => screen.getByRole("region", { name: "Trend" });

async function renderPage() {
  const utils = renderWithProviders(<OverviewPage />);
  await waitFor(() => expect(trendRegion().querySelector(".recharts-line")).not.toBeNull());
  return utils;
}

describe("OverviewPage", () => {
  it("renders KPI cards with deltas and the trend chart", async () => {
    await renderPage();
    const kpis = within(screen.getByRole("group", { name: "Key metrics" })).getAllByRole("button");
    expect(kpis).toHaveLength(6);
    await waitFor(() => expect(within(kpis[0]).getByTitle("vs. previous period")).toBeInTheDocument());
    expect(kpis[0]).toHaveTextContent("Sessions");
    expect(kpis[5]).toHaveTextContent(/Engagement rate/);
    expect(kpis[5]).toHaveTextContent(/%/);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/compared to the previous period/)).toBeInTheDocument();
  });

  it("toggles metrics on the trend chart via KPI cards, never below one", async () => {
    await renderPage();
    const region = trendRegion();
    expect(region.querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(region).toHaveTextContent("Sessions, Users");

    await userEvent.click(screen.getByRole("button", { name: /^New users/ }));
    await waitFor(() => expect(region.querySelectorAll(".recharts-line")).toHaveLength(3));
    expect(screen.getByRole("button", { name: /^New users/ })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /^Users/ }));
    await userEvent.click(screen.getByRole("button", { name: /^New users/ }));
    await waitFor(() => expect(region.querySelectorAll(".recharts-line")).toHaveLength(1));

    // The last remaining metric can't be removed.
    await userEvent.click(screen.getByRole("button", { name: /^Sessions/ }));
    expect(region.querySelectorAll(".recharts-line")).toHaveLength(1);
  });

  it("plots engagement rate on a secondary axis", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: /^Engagement rate/ }));
    await waitFor(() => expect(trendRegion().querySelectorAll(".recharts-yAxis")).toHaveLength(2));
  });

  it("switches chart type", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    await waitFor(() => expect(trendRegion().querySelectorAll(".recharts-bar")).toHaveLength(2));
    await userEvent.click(screen.getByRole("radio", { name: "Area" }));
    await waitFor(() => expect(trendRegion().querySelectorAll(".recharts-area")).toHaveLength(2));
  });

  it("filters the page when a channel slice is clicked, and clears via the pill", async () => {
    await renderPage();
    const channels = screen.getByRole("region", { name: "Sessions by channel" });
    await waitFor(() => expect(channels.querySelectorAll(".recharts-pie-sector").length).toBeGreaterThan(0));

    fetchReport.mockClear();
    fetchSummary.mockClear();
    fireEvent.click(channels.querySelectorAll(".recharts-pie-sector")[0]);

    const pill = await screen.findByText(/Channel: /);
    const value = pill.textContent!.replace("Channel: ", "").replace("×", "").trim();
    const filter = { dimension: "sessionDefaultChannelGroup", value };

    await waitFor(() => expect(fetchSummary).toHaveBeenCalledWith(expect.objectContaining({ filter })));
    expect(fetchReport).toHaveBeenCalledWith("overview", expect.objectContaining({ filter }));
    expect(fetchReport).toHaveBeenCalledWith("devices", expect.objectContaining({ filter }));
    // The channel pie itself stays unfiltered (same query, no refetch) so the selection remains visible.
    expect(fetchReport).not.toHaveBeenCalledWith("traffic-sources", expect.anything());

    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.queryByText(/Channel: /)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchSummary).toHaveBeenLastCalledWith(expect.objectContaining({ filter: null })));
  });

  it("selecting a device replaces a channel filter", async () => {
    await renderPage();
    const channels = screen.getByRole("region", { name: "Sessions by channel" });
    const devices = screen.getByRole("region", { name: "Sessions by device" });
    await waitFor(() => expect(devices.querySelectorAll(".recharts-pie-sector").length).toBeGreaterThan(0));

    fireEvent.click(channels.querySelectorAll(".recharts-pie-sector")[0]);
    await screen.findByText(/Channel: /);
    // Previous data stays visible (marked busy) while the filtered data loads.
    expect(devices.querySelectorAll(".recharts-pie-sector").length).toBeGreaterThan(0);
    await waitFor(() => expect(devices).not.toHaveAttribute("aria-busy"));

    fireEvent.click(devices.querySelectorAll(".recharts-pie-sector")[0]);
    await screen.findByText(/Device: /);
    expect(screen.queryByText(/Channel: /)).not.toBeInTheDocument();
  });

  it("shows errors from the API with a retry action", async () => {
    fetchReport.mockImplementation(async (name, params) => {
      if (name === "overview") throw new Error("GA exploded");
      return (await import("@tests/helpers/mockAnalytics")).mockApi.fetchReport(name, params);
    });
    renderWithProviders(<OverviewPage />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("GA exploded");

    resetMockAnalytics();
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(trendRegion().querySelector(".recharts-line")).not.toBeNull());
  });
});

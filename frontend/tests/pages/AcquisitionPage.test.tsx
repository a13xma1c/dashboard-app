import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcquisitionPage from "@/pages/AcquisitionPage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchCustomReport, fetchReport, resetMockAnalytics } from "@tests/helpers/mockAnalytics";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

describe("AcquisitionPage", () => {
  it("renders the stacked channel chart, pie and tables", async () => {
    renderWithProviders(<AcquisitionPage />);
    const stacked = screen.getByRole("region", { name: "Sessions by channel over time" });
    await waitFor(() => expect(stacked.querySelectorAll(".recharts-area")).toHaveLength(6)); // top 5 + Other
    expect(stacked).toHaveTextContent("Top 5 channels, stacked");
    expect(within(stacked).getByText("Other")).toBeInTheDocument();
    expect(fetchCustomReport).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: ["date", "sessionDefaultChannelGroup"], metrics: ["sessions"] })
    );

    await waitFor(() => expect(screen.getByRole("table", { name: "Channels table" })).toBeInTheDocument());
    expect(screen.getByRole("table", { name: "Source / medium table" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Landing pages table" })).toBeInTheDocument();
    expect(fetchReport).toHaveBeenCalledWith("source-medium", expect.objectContaining({ limit: 100 }));
  });

  it("focuses everything on a channel when a table row is clicked", async () => {
    renderWithProviders(<AcquisitionPage />);
    const table = await screen.findByRole("table", { name: "Channels table" });
    const firstRow = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")[0];
    const channel = within(firstRow).getAllByRole("cell")[0].textContent!;

    fetchReport.mockClear();
    fetchCustomReport.mockClear();
    await userEvent.click(firstRow);

    const filter = { dimension: "sessionDefaultChannelGroup", value: channel };
    expect(screen.getByText(`Channel: ${channel}`)).toBeInTheDocument();
    await waitFor(() => expect(fetchReport).toHaveBeenCalledWith("source-medium", expect.objectContaining({ filter })));
    expect(fetchCustomReport).toHaveBeenCalledWith(expect.objectContaining({ filter }));
    // The channel widgets own the filter, so they keep their unfiltered query and aren't refetched.
    expect(fetchReport).not.toHaveBeenCalledWith("traffic-sources", expect.anything());

    const stacked = screen.getByRole("region", { name: "Sessions by channel over time" });
    await waitFor(() => expect(stacked).toHaveTextContent(`Only ${channel}`));
    await waitFor(() => expect(stacked.querySelectorAll(".recharts-area")).toHaveLength(1));
    expect(firstRow).toHaveAttribute("aria-selected", "true");

    // Clicking the same row again clears the filter.
    await userEvent.click(firstRow);
    expect(screen.queryByText(`Channel: ${channel}`)).not.toBeInTheDocument();
  });
});

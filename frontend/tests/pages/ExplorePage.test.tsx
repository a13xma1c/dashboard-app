import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExplorePage from "@/pages/ExplorePage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchCustomReport, fetchMetadata, resetMockAnalytics } from "@tests/helpers/mockAnalytics";
import * as csv from "@/lib/csv";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

describe("ExplorePage", () => {
  it("runs the default report on load and renders chart + table", async () => {
    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Date" })).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Sessions" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Total users" })).toBeChecked();

    await waitFor(() => expect(screen.getByRole("table", { name: "Custom report results" })).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Chart" }).querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Results" })).toHaveTextContent("14 rows");
    expect(fetchCustomReport).toHaveBeenCalledWith(expect.objectContaining({ dimensions: ["date"], metrics: ["sessions", "totalUsers"], limit: 100 }));
  });

  it("builds and runs a categorical report with a bar chart", async () => {
    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Date" })).toBeChecked());

    await userEvent.click(screen.getByRole("checkbox", { name: "Date" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Country" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Total users" }));
    const limit = screen.getByLabelText("Row limit");
    await userEvent.clear(limit);
    await userEvent.type(limit, "5");

    await userEvent.click(screen.getByRole("button", { name: "Run report" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Top 5 by sessions" })).toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Top 5 by sessions" }).querySelectorAll(".recharts-bar-rectangle")).toHaveLength(5);
    expect(fetchCustomReport).toHaveBeenLastCalledWith(expect.objectContaining({ dimensions: ["country"], metrics: ["sessions"], limit: 5 }));
    expect(screen.getByRole("button", { name: "Re-run" })).toBeInTheDocument();
  });

  it("shows no chart for multi-dimension reports", async () => {
    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Date" })).toBeChecked());
    await userEvent.click(screen.getByRole("checkbox", { name: "Device category" }));
    await userEvent.click(screen.getByRole("button", { name: "Run report" }));
    await waitFor(() => expect(fetchCustomReport).toHaveBeenLastCalledWith(expect.objectContaining({ dimensions: ["date", "deviceCategory"] })));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Chart" })).not.toBeInTheDocument());
    expect(screen.getByRole("table", { name: "Custom report results" })).toBeInTheDocument();
  });

  it("requires at least one metric and caps selections at five", async () => {
    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Sessions" })).toBeChecked());

    await userEvent.click(screen.getByRole("checkbox", { name: "Sessions" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Total users" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one metric.");
    expect(screen.getByRole("button", { name: "Run report" })).toBeDisabled();

    for (const name of ["Sessions", "Total users", "New users", "Views", "Event count"]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }
    expect(screen.getByText("Metrics (5/5)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Conversions" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Sessions" })).toBeEnabled();
  });

  it("exports the result as CSV", async () => {
    const download = vi.spyOn(csv, "downloadText").mockImplementation(() => {});
    renderWithProviders(<ExplorePage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(download).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = download.mock.calls[0];
    expect(filename).toBe("ga-123456789-date.csv");
    expect(content.startsWith("date,sessions,totalUsers\r\n")).toBe(true);
    expect(mime).toBe("text/csv");
    download.mockRestore();
  });

  it("reports metadata failures", async () => {
    fetchMetadata.mockRejectedValueOnce(new Error("nope"));
    renderWithProviders(<ExplorePage />);
    expect(await screen.findByText("Could not load field list.")).toBeInTheDocument();
  });

  it("clamps the row limit on blur and falls back to the default when blank", async () => {
    renderWithProviders(<ExplorePage />);
    const limit = screen.getByLabelText("Row limit");
    await userEvent.clear(limit);
    await userEvent.type(limit, "99999");
    await userEvent.tab();
    expect(limit).toHaveValue(10000);

    await userEvent.clear(limit);
    await userEvent.type(limit, "0");
    await userEvent.tab();
    expect(limit).toHaveValue(1);

    await userEvent.clear(limit);
    await userEvent.tab();
    expect(limit).toHaveValue(100);
  });

  it("shows the results table only", async () => {
    renderWithProviders(<ExplorePage />);
    const results = await screen.findByRole("region", { name: "Results" });
    await waitFor(() => expect(within(results).getByRole("table")).toBeInTheDocument());
  });
});

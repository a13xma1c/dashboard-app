import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContentPage from "@/pages/ContentPage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchReport, resetMockAnalytics } from "@tests/helpers/mockAnalytics";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

describe("ContentPage", () => {
  it("renders the trend, pages table, events and landing pages", async () => {
    renderWithProviders(<ContentPage />);
    expect(screen.getByRole("region", { name: "Trend — all pages" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("table", { name: "Top pages table" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("region", { name: "Events" }).querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0));
    expect(screen.getByRole("table", { name: "Landing pages table" })).toBeInTheDocument();
  });

  it("toggles trend metrics with chips", async () => {
    renderWithProviders(<ContentPage />);
    const trend = screen.getByRole("region", { name: "Trend — all pages" });
    await waitFor(() => expect(trend.querySelectorAll(".recharts-line")).toHaveLength(1));
    const chips = screen.getByRole("group", { name: "Trend metrics" });
    await userEvent.click(within(chips).getByRole("button", { name: "Sessions" }));
    expect(within(chips).getByRole("button", { name: "Sessions" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(trend.querySelectorAll(".recharts-line")).toHaveLength(2));
  });

  it("drills into a page: trend title, events filter and pill", async () => {
    renderWithProviders(<ContentPage />);
    const table = await screen.findByRole("table", { name: "Top pages table" });
    const firstRow = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")[0];
    const page = within(firstRow).getAllByRole("cell")[0].textContent!;

    fetchReport.mockClear();
    await userEvent.click(firstRow);

    const filter = { dimension: "pagePath", value: page };
    expect(screen.getByRole("region", { name: `Trend for ${page}` })).toBeInTheDocument();
    expect(screen.getByText(`Page: ${page}`)).toBeInTheDocument();
    await waitFor(() => expect(fetchReport).toHaveBeenCalledWith("events", expect.objectContaining({ filter })));
    expect(fetchReport).toHaveBeenCalledWith("overview", expect.objectContaining({ filter }));
    expect(screen.getByRole("region", { name: "Events" })).toHaveTextContent(`On ${page}`);

    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getByRole("region", { name: "Trend — all pages" })).toBeInTheDocument();
  });

  it("searches the pages table", async () => {
    renderWithProviders(<ContentPage />);
    await screen.findByRole("table", { name: "Top pages table" });
    const search = screen.getAllByRole("searchbox")[0];
    await userEvent.type(search, "/docs");
    const table = screen.getByRole("table", { name: "Top pages table" });
    const rows = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row");
    for (const row of rows) expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("/docs");
  });
});

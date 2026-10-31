import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GeographyPage from "@/pages/GeographyPage";
import { renderWithProviders } from "@tests/helpers/render";
import { fetchReport, resetMockAnalytics } from "@tests/helpers/mockAnalytics";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

beforeEach(() => resetMockAnalytics());

describe("GeographyPage", () => {
  it("renders top countries, worldwide trend, and tables", async () => {
    renderWithProviders(<GeographyPage />);
    const top = screen.getByRole("region", { name: "Top countries" });
    await waitFor(() => expect(top.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(10));
    expect(screen.getByRole("region", { name: "Sessions worldwide" })).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Countries table" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Top cities" })).toBeInTheDocument();
  });

  it("re-ranks countries by a different metric", async () => {
    renderWithProviders(<GeographyPage />);
    const top = screen.getByRole("region", { name: "Top countries" });
    await waitFor(() => expect(top.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(10));
    await userEvent.click(screen.getByRole("radio", { name: "New users" }));
    expect(top).toHaveTextContent("By new users");
  });

  it("drills into a country from the bar chart", async () => {
    renderWithProviders(<GeographyPage />);
    const top = screen.getByRole("region", { name: "Top countries" });
    await waitFor(() => expect(top.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(10));

    fetchReport.mockClear();
    fireEvent.click(top.querySelectorAll(".recharts-bar-rectangle")[0]);

    const pill = await screen.findByText(/Country: /);
    const country = pill.textContent!.replace("Country: ", "").replace("×", "").trim();
    const filter = { dimension: "country", value: country };

    expect(screen.getByRole("region", { name: `Sessions in ${country}` })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: `Cities in ${country}` })).toBeInTheDocument();
    await waitFor(() => expect(fetchReport).toHaveBeenCalledWith("cities", expect.objectContaining({ filter })));
    expect(fetchReport).toHaveBeenCalledWith("overview", expect.objectContaining({ filter }));

    // Countries table reflects the selection
    const table = screen.getByRole("table", { name: "Countries table" });
    const selected = within(table).getAllByRole("row").find((r) => r.getAttribute("aria-selected") === "true");
    expect(selected).toHaveTextContent(country);
  });

  it("drills in from the table and toggles back out", async () => {
    renderWithProviders(<GeographyPage />);
    const table = await screen.findByRole("table", { name: "Countries table" });
    const row = within(within(table).getAllByRole("rowgroup")[1]).getAllByRole("row")[1];
    const country = within(row).getAllByRole("cell")[0].textContent!;
    await userEvent.click(row);
    expect(screen.getByText(`Country: ${country}`)).toBeInTheDocument();
    await userEvent.click(row);
    expect(screen.queryByText(`Country: ${country}`)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sessions worldwide" })).toBeInTheDocument();
  });
});

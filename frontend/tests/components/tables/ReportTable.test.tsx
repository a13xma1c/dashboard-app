import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReportTable from "@/components/tables/ReportTable";
import { makeReport } from "@tests/helpers/render";

const report = makeReport(
  ["pagePath", "screenPageViews", "averageSessionDuration", "bounceRate"],
  [
    ["/", 1000, 125, 0.35],
    ["/pricing", 400, 60, 0.5],
    ["/blog", 700, 90.2, 0.41],
  ]
);

describe("ReportTable", () => {
  it("derives labelled, typed columns and sorts by the first metric", () => {
    render(<ReportTable report={report} dimensionCount={1} />);
    expect(screen.getByRole("columnheader", { name: /^Page/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Views/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Avg. session duration/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Bounce rate/ })).toBeInTheDocument();

    const body = screen.getAllByRole("rowgroup")[1];
    const first = within(body).getAllByRole("row")[0];
    const cells = within(first).getAllByRole("cell").map((c) => c.textContent);
    expect(cells).toEqual(["/", "1,000", "2m 05s", "35.0%"]);
  });

  it("supports two dimension columns and row selection", async () => {
    const onRowClick = vi.fn();
    const r = makeReport(["sessionSource", "sessionMedium", "sessions"], [["google", "organic", 5], ["bing", "cpc", 2]]);
    render(<ReportTable report={r} dimensionCount={2} onRowClick={onRowClick} selectedKey={"bing\u0000cpc"} />);
    const body = screen.getAllByRole("rowgroup")[1];
    const rowsEl = within(body).getAllByRole("row");
    expect(rowsEl[1]).toHaveAttribute("aria-selected", "true");
    await userEvent.click(rowsEl[0]);
    expect(onRowClick).toHaveBeenCalledWith({ sessionSource: "google", sessionMedium: "organic", sessions: "5" });
  });

  it("formats dimension values and sorts time-based reports chronologically by default", () => {
    const r = makeReport(["date", "sessions"], [["20250302", 5], ["20250301", 3]]);
    render(<ReportTable report={r} dimensionCount={1} />);
    expect(screen.getByRole("columnheader", { name: /Date/ })).toHaveAttribute("aria-sort", "ascending");
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).getAllByRole("row")[0]).toHaveTextContent("Mar 1");
  });

  it("sorts dimensionless reports by nothing in particular", () => {
    const r = makeReport(["sessions"], [[3]]);
    render(<ReportTable report={r} dimensionCount={0} />);
    expect(screen.getByRole("columnheader", { name: /Sessions/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("can disable the bar and search", () => {
    render(<ReportTable report={report} dimensionCount={1} barMetric={null} searchable={false} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(document.querySelectorAll("td span[aria-hidden='true']")).toHaveLength(0);
  });
});

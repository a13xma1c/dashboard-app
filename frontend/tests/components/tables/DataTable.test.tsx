import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from "@/components/tables/DataTable";
import type { Column } from "@/components/tables/DataTable";

interface Row {
  name: string;
  sessions: number;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name },
  { key: "sessions", header: "Sessions", accessor: (r) => r.sessions, align: "right", bar: true, render: (r) => r.sessions.toLocaleString() },
];

const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({ name: `Row ${String(i + 1).padStart(2, "0")}`, sessions: (i + 1) * 100 }));

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((r) => within(r).getAllByRole("cell")[0].textContent);

describe("DataTable", () => {
  it("paginates", async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} pageSize={10} />);
    expect(bodyNames()).toHaveLength(10);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(bodyNames()[0]).toBe("Row 11");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(bodyNames()).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("sorts by column, toggling direction, with numeric columns defaulting to desc", async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} pageSize={5} />);
    const sessionsHeader = screen.getByRole("columnheader", { name: /Sessions/ });

    await userEvent.click(within(sessionsHeader).getByRole("button"));
    expect(sessionsHeader).toHaveAttribute("aria-sort", "descending");
    expect(bodyNames()[0]).toBe("Row 25");

    await userEvent.click(within(sessionsHeader).getByRole("button"));
    expect(sessionsHeader).toHaveAttribute("aria-sort", "ascending");
    expect(bodyNames()[0]).toBe("Row 01");

    const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
    await userEvent.click(within(nameHeader).getByRole("button"));
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(sessionsHeader).toHaveAttribute("aria-sort", "none");
  });

  it("respects initialSort", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} initialSort={{ key: "sessions", direction: "desc" }} />);
    expect(bodyNames()[0]).toBe("Row 25");
  });

  it("filters with search and resets to page 1", async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} pageSize={10} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(screen.getByRole("searchbox"), "row 2");
    expect(screen.getByText("6 of 25 rows")).toBeInTheDocument(); // Row 20 … Row 25
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument(); // fits on one page again
    expect(bodyNames()[0]).toBe("Row 20");
  });

  it("shows an empty message when nothing matches", async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} emptyMessage="Nada" />);
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("Nada")).toBeInTheDocument();
    expect(screen.getByText("0 of 25 rows")).toBeInTheDocument();
  });

  it("hides the toolbar when not searchable and data fits one page", () => {
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} rowKey={(r) => r.name} searchable={false} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/rows/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("supports row click, keyboard activation and selection", async () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows.slice(0, 3)} rowKey={(r) => r.name} onRowClick={onRowClick} selectedKey="Row 02" />);
    const body = screen.getAllByRole("rowgroup")[1];
    const bodyRows = within(body).getAllByRole("row");

    await userEvent.click(bodyRows[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    bodyRows[2].focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenLastCalledWith(rows[2]);
    await userEvent.keyboard(" ");
    expect(onRowClick).toHaveBeenCalledTimes(3);

    expect(bodyRows[1]).toHaveAttribute("aria-selected", "true");
    expect(bodyRows[0]).toHaveAttribute("aria-selected", "false");
  });

  it("renders proportional bars and custom renderers", () => {
    render(<DataTable columns={columns} rows={rows.slice(0, 2)} rowKey={(r) => r.name} />);
    expect(screen.getByText("200")).toBeInTheDocument();
    const bars = document.querySelectorAll("td span[aria-hidden='true']");
    expect(bars).toHaveLength(2);
    expect((bars[1] as HTMLElement).style.width).toBe("44px");
    expect((bars[0] as HTMLElement).style.width).toBe("22px");
  });

  it("resets to the first page when rows change", async () => {
    const { rerender } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.name} pageSize={10} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    rerender(<DataTable columns={columns} rows={rows.slice(0, 15)} rowKey={(r) => r.name} pageSize={10} />);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
});

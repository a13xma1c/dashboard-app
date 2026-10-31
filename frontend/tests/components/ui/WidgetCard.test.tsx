import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WidgetCard from "@/components/ui/WidgetCard";

const baseQuery = { isPending: false, isError: false, error: null, refetch: vi.fn(), data: undefined, isFetching: false };

describe("WidgetCard", () => {
  it("renders title, subtitle, actions and children", () => {
    render(
      <WidgetCard title="Trend" subtitle="Sessions" actions={<button>Toggle</button>}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByRole("heading", { name: "Trend" })).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle" })).toBeInTheDocument();
    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trend" })).toBeInTheDocument();
  });

  it("shows a skeleton while pending", () => {
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, isPending: true }}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Loading Trend/);
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
  });

  it("shows the error with a retry button", async () => {
    const refetch = vi.fn();
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, isError: true, error: new Error("Kaboom"), refetch }}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Kaboom");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows an empty message when the report has no rows", () => {
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, data: { headers: [], rows: [] } }}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByText("No data for this period.")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
  });

  it("honours isEmpty and emptyMessage overrides", () => {
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, data: { headers: [], rows: [["x"]] } }} isEmpty emptyMessage="Nothing here">
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders children when data is present", () => {
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, data: { headers: ["a"], rows: [["1"]] } }} height={200}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("marks the region busy while refetching", () => {
    render(
      <WidgetCard title="Trend" query={{ ...baseQuery, data: { headers: ["a"], rows: [["1"]] }, isFetching: true }}>
        <div>chart</div>
      </WidgetCard>
    );
    expect(screen.getByRole("region", { name: "Trend" })).toHaveAttribute("aria-busy", "true");
  });
});

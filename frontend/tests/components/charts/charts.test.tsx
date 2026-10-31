import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import BreakdownPie from "@/components/charts/BreakdownPie";
import BreakdownBar from "@/components/charts/BreakdownBar";
import { CATEGORY_COLORS, categoryColor, metricColor } from "@/components/charts/palette";

const series = Array.from({ length: 14 }, (_, i) => ({
  x: `202503${String(i + 1).padStart(2, "0")}`,
  sessions: 100 + i,
  totalUsers: 80 + i,
  engagementRate: 0.5,
}));

const items = [
  { name: "desktop", value: 60, share: 0.6 },
  { name: "mobile", value: 30, share: 0.3 },
  { name: "tablet", value: 10, share: 0.1 },
];

describe("palette", () => {
  it("cycles category colours and has stable metric colours", () => {
    expect(categoryColor(0)).toBe(CATEGORY_COLORS[0]);
    expect(categoryColor(CATEGORY_COLORS.length)).toBe(CATEGORY_COLORS[0]);
    expect(metricColor("sessions")).toBe("#3b82d4");
    expect(metricColor("unknown", 2)).toBe(CATEGORY_COLORS[2]);
  });
});

describe("TimeSeriesChart", () => {
  it("renders one line per metric with labels in the legend", () => {
    const { container } = render(<TimeSeriesChart data={series} metrics={["sessions", "totalUsers"]} />);
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("renders area and bar variants, optionally stacked", () => {
    const { container, rerender } = render(<TimeSeriesChart data={series} metrics={["sessions"]} chartType="area" />);
    expect(container.querySelectorAll(".recharts-area")).toHaveLength(1);
    rerender(<TimeSeriesChart data={series} metrics={["sessions", "totalUsers"]} chartType="bar" stacked />);
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(2);
  });

  it("adds a right axis for rate metrics", () => {
    const { container } = render(<TimeSeriesChart data={series} metrics={["sessions", "engagementRate"]} />);
    expect(container.querySelectorAll(".recharts-yAxis")).toHaveLength(2);
  });

  it("shows a brush for long series when requested", () => {
    const { container, rerender } = render(<TimeSeriesChart data={series} metrics={["sessions"]} brush />);
    expect(container.querySelector(".recharts-brush")).not.toBeNull();
    rerender(<TimeSeriesChart data={series.slice(0, 5)} metrics={["sessions"]} brush />);
    expect(container.querySelector(".recharts-brush")).toBeNull();
  });

  it("uses custom labels and colours", () => {
    const { container } = render(
      <TimeSeriesChart data={series} metrics={["sessions"]} labels={{ sessions: "Organic" }} colors={{ sessions: "#123456" }} />
    );
    expect(screen.getByText("Organic")).toBeInTheDocument();
    expect(container.querySelector(".recharts-line path")?.getAttribute("stroke")).toBe("#123456");
  });

  it("formats x ticks for the given dimension", () => {
    render(<TimeSeriesChart data={[{ x: "09", sessions: 1 }, { x: "14", sessions: 2 }]} metrics={["sessions"]} xDimension="hour" />);
    expect(screen.getByText("9am")).toBeInTheDocument();
  });
});

describe("BreakdownPie", () => {
  it("renders a sector per item and legend entries with shares", () => {
    const { container } = render(<BreakdownPie items={items} />);
    expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(3);
    expect(screen.getByText("desktop")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("dims unselected slices and outlines the selected one", () => {
    const { container } = render(<BreakdownPie items={items} selected="mobile" onSelect={() => {}} />);
    const sectors = container.querySelectorAll(".recharts-pie-sector path");
    expect(sectors[0].getAttribute("fill-opacity")).toBe("0.3");
    expect(sectors[1].getAttribute("fill-opacity")).toBe("1");
    expect(sectors[1].getAttribute("stroke-width")).toBe("2");
  });

  it("calls onSelect when a sector is clicked and toggles off on the same one", () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(<BreakdownPie items={items} onSelect={onSelect} />);
    fireEvent.click(container.querySelectorAll(".recharts-pie-sector")[1]);
    expect(onSelect).toHaveBeenCalledWith("mobile");

    rerender(<BreakdownPie items={items} selected="mobile" onSelect={onSelect} />);
    fireEvent.click(container.querySelectorAll(".recharts-pie-sector")[1]);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("selects from the legend too", () => {
    const onSelect = vi.fn();
    render(<BreakdownPie items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("tablet"));
    expect(onSelect).toHaveBeenCalledWith("tablet");
  });

  it("can render a full pie", () => {
    const { container } = render(<BreakdownPie items={items} donut={false} />);
    expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(3);
  });
});

describe("BreakdownBar", () => {
  it("renders horizontal bars with labels", () => {
    const { container } = render(<BreakdownBar items={items} />);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(3);
    expect(screen.getByText("desktop")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument(); // value label
  });

  it("grows with the number of rows", () => {
    const { container } = render(<BreakdownBar items={items} rowHeight={40} minHeight={10} />);
    expect((container.firstChild as HTMLElement).style.height).toBe("136px");
  });

  it("supports a vertical layout with a label formatter", () => {
    const { container } = render(
      <BreakdownBar items={[{ name: "09", value: 1, share: 1 }]} layout="vertical" labelFormatter={(n) => `${n}h`} />
    );
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(1);
    expect(screen.getByText("09h")).toBeInTheDocument();
  });

  it("handles selection and clicks", () => {
    const onSelect = vi.fn();
    const { container } = render(<BreakdownBar items={items} selected="desktop" onSelect={onSelect} color="#000" />);
    const rects = container.querySelectorAll(".recharts-bar-rectangle path");
    expect(rects[0].getAttribute("fill-opacity")).toBe("1");
    expect(rects[1].getAttribute("fill-opacity")).toBe("0.3");
    expect(rects[1].getAttribute("fill")).toBe("#000");

    fireEvent.click(container.querySelectorAll(".recharts-bar-rectangle")[1]);
    expect(onSelect).toHaveBeenCalledWith("mobile");
    fireEvent.click(container.querySelectorAll(".recharts-bar-rectangle")[0]);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("clicks in vertical layout", () => {
    const onSelect = vi.fn();
    const { container } = render(<BreakdownBar items={items} layout="vertical" onSelect={onSelect} />);
    fireEvent.click(container.querySelectorAll(".recharts-bar-rectangle")[2]);
    expect(onSelect).toHaveBeenCalledWith("tablet");
  });
});

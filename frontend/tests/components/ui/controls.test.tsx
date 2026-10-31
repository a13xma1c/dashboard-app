import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ChipToggleGroup from "@/components/ui/ChipToggleGroup";
import FilterPill from "@/components/ui/FilterPill";
import Badge from "@/components/ui/Badge";

describe("SegmentedControl", () => {
  it("renders radios and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={[{ value: "line", label: "Line" }, { value: "bar", label: "Bar" }]}
        value="line"
        onChange={onChange}
        aria-label="Chart type"
      />
    );
    expect(screen.getByRole("radiogroup", { name: "Chart type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Line" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    expect(onChange).toHaveBeenCalledWith("bar");
  });
});

describe("ChipToggleGroup", () => {
  const options = [
    { value: "a", label: "A", color: "#111" },
    { value: "b", label: "B" },
  ];

  it("adds and removes selections", async () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup options={options} selected={["a"]} onChange={onChange} aria-label="Metrics" />);
    expect(screen.getByRole("button", { name: "A" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("removes a selected chip", async () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup options={options} selected={["a", "b"]} onChange={onChange} aria-label="Metrics" />);
    await userEvent.click(screen.getByRole("button", { name: "A" }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("refuses to deselect below the minimum", async () => {
    const onChange = vi.fn();
    render(<ChipToggleGroup options={options} selected={["a"]} onChange={onChange} aria-label="Metrics" />);
    await userEvent.click(screen.getByRole("button", { name: "A" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("FilterPill", () => {
  it("shows the filter and clears it", async () => {
    const onClear = vi.fn();
    render(<FilterPill filter={{ dimension: "deviceCategory", value: "mobile" }} onClear={onClear} />);
    expect(screen.getByText(/Device: mobile/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("formats dimension values", () => {
    render(<FilterPill filter={{ dimension: "date", value: "20250301" }} onClear={() => {}} />);
    expect(screen.getByText(/Date: Mar 1/)).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders its children with a title", () => {
    render(<Badge title="tip">Demo</Badge>);
    expect(screen.getByTitle("tip")).toHaveTextContent("Demo");
  });
});

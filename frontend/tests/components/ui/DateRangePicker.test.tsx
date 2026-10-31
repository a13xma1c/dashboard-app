import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DateRangePicker from "@/components/ui/DateRangePicker";

describe("DateRangePicker", () => {
  it("shows the current range and opens the popover", async () => {
    render(<DateRangePicker value={{ start: "29daysAgo", end: "today" }} onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Last 30 days/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Select date range" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("applies a preset and closes", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ start: "29daysAgo", end: "today" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Last 30 days/ }));
    await userEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
    expect(onChange).toHaveBeenCalledWith({ start: "6daysAgo", end: "today" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies a valid custom range", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ start: "29daysAgo", end: "today" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Last 30 days/ }));
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2024-01-31" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ start: "2024-01-01", end: "2024-01-31" });
  });

  it("rejects an inverted custom range", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ start: "29daysAgo", end: "today" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Last 30 days/ }));
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2024-02-01" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2024-01-01" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/before end/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on Cancel, Escape and outside click", async () => {
    render(
      <div>
        <span>outside</span>
        <DateRangePicker value={{ start: "29daysAgo", end: "today" }} onChange={() => {}} />
      </div>
    );
    const trigger = screen.getByRole("button", { name: /Last 30 days/ });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("describes custom ranges and syncs inputs when the value changes", () => {
    const { rerender } = render(<DateRangePicker value={{ start: "2025-03-01", end: "2025-03-14" }} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Mar 1, 2025 – Mar 14, 2025/ })).toBeInTheDocument();
    rerender(<DateRangePicker value={{ start: "2025-01-01", end: "2025-01-05" }} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Jan 1, 2025/ }));
    expect(screen.getByLabelText("Start")).toHaveValue("2025-01-01");
    expect(screen.getByLabelText("End")).toHaveValue("2025-01-05");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import KpiCard from "@/components/ui/KpiCard";

describe("KpiCard", () => {
  it("formats the value by type", () => {
    render(<KpiCard label="Engagement" value={0.6412} type="percent" />);
    expect(screen.getByText("64.1%")).toBeInTheDocument();
    expect(screen.getByText("Engagement")).toBeInTheDocument();
  });

  it("shows a positive delta as an improvement", () => {
    render(<KpiCard label="Sessions" value={110} previous={100} />);
    const delta = screen.getByTitle("vs. previous period");
    expect(delta).toHaveTextContent("+10.0%");
    expect(delta).toHaveTextContent("vs 100");
    expect(delta.className).toMatch(/up/);
  });

  it("shows a negative delta as a regression", () => {
    render(<KpiCard label="Sessions" value={90} previous={100} />);
    expect(screen.getByTitle("vs. previous period").className).toMatch(/down/);
  });

  it("inverts the colour for lower-is-better metrics", () => {
    render(<KpiCard label="Bounce" value={0.4} previous={0.5} type="percent" lowerIsBetter />);
    expect(screen.getByTitle("vs. previous period").className).toMatch(/up/);
  });

  it("treats tiny changes as flat", () => {
    render(<KpiCard label="Sessions" value={100.01} previous={100} />);
    expect(screen.getByTitle("vs. previous period").className).toMatch(/flat/);
  });

  it("shows a skeleton while loading or without a value", () => {
    const { rerender } = render(<KpiCard label="Sessions" loading />);
    expect(screen.queryByTitle("vs. previous period")).not.toBeInTheDocument();
    rerender(<KpiCard label="Sessions" />);
    expect(document.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });

  it("becomes a toggle button when onClick is given", async () => {
    const onClick = vi.fn();
    render(<KpiCard label="Sessions" value={1} active onClick={onClick} color="#f00" />);
    const button = screen.getByRole("button", { pressed: true });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.style.getPropertyValue("--accent")).toBe("#f00");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PropertySelector from "@/components/ui/PropertySelector";

describe("PropertySelector", () => {
  it("applies the trimmed value on submit", async () => {
    const onChange = vi.fn();
    render(<PropertySelector value="" onChange={onChange} />);
    const input = screen.getByLabelText("GA4 Property ID");
    await userEvent.type(input, "  123 {Enter}");
    expect(onChange).toHaveBeenCalledWith("123");
  });

  it("applies via the button and disables it when unchanged or blank", async () => {
    const onChange = vi.fn();
    render(<PropertySelector value="123" onChange={onChange} />);
    const button = screen.getByRole("button", { name: "Apply" });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText("GA4 Property ID");
    await userEvent.clear(input);
    expect(button).toBeDisabled();

    await userEvent.type(input, "456");
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onChange).toHaveBeenCalledWith("456");
  });

  it("resets the draft when the applied value changes", () => {
    const { rerender } = render(<PropertySelector value="1" onChange={() => {}} />);
    rerender(<PropertySelector value="2" onChange={() => {}} />);
    expect(screen.getByLabelText("GA4 Property ID")).toHaveValue("2");
  });

  it("hides the label visually in compact mode but keeps it accessible", () => {
    render(<PropertySelector value="" onChange={() => {}} compact />);
    expect(screen.getByLabelText("GA4 Property ID")).toBeInTheDocument();
  });
});

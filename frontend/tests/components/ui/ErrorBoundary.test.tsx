import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <div>fine</div>;
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("shows the error and recovers via Try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let explode = true;
    const Child = () => <Bomb explode={explode} />;
    render(
      <ErrorBoundary>
        <Child />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("kaboom");

    explode = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("resets when resetKey changes (navigation)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Bomb explode />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(
      <ErrorBoundary resetKey="/b">
        <Bomb explode={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("stays in the error state while the key is unchanged and reports via onError", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // jsdom re-logs caught render errors
    const onError = vi.fn();
    const { rerender } = render(
      <ErrorBoundary resetKey="/a" onError={onError}>
        <Bomb explode />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary resetKey="/a" onError={onError}>
        <Bomb explode={false} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom lacks ResizeObserver, which Recharts' ResponsiveContainer relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// jsdom doesn't implement layout; give Recharts something non-zero to work with.
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 800 });
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 400 });
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 400 });

if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}

// ResponsiveContainer measures its parent, which is always 0×0 in jsdom.
// Replace it with a fixed-size box so charts actually render their SVG.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  const React = await import("react");
  const ResponsiveContainer = ({
    children,
    width,
    height,
  }: {
    children: React.ReactElement<{ width?: number; height?: number }>;
    width?: number | string;
    height?: number | string;
  }) => {
    const w = typeof width === "number" ? width : 800;
    const h = typeof height === "number" ? height : 300;
    return React.createElement(
      "div",
      { className: "recharts-responsive-container", style: { width: w, height: h } },
      React.cloneElement(children, { width: w, height: h })
    );
  };
  return { ...actual, ResponsiveContainer };
});

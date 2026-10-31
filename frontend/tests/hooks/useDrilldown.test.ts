import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDrilldown } from "@/hooks/useDrilldown";

describe("useDrilldown", () => {
  it("starts with no filter", () => {
    const { result } = renderHook(() => useDrilldown());
    expect(result.current.filter).toBeNull();
    expect(result.current.filterFor("country")).toBeNull();
    expect(result.current.selectedIn("country")).toBeNull();
  });

  it("selects a value and exposes it to other dimensions only", () => {
    const { result } = renderHook(() => useDrilldown());
    act(() => result.current.select("deviceCategory", "mobile"));

    expect(result.current.filter).toEqual({ dimension: "deviceCategory", value: "mobile" });
    // The owning widget is not filtered but knows what's selected…
    expect(result.current.filterFor("deviceCategory")).toBeNull();
    expect(result.current.selectedIn("deviceCategory")).toBe("mobile");
    // …every other widget is narrowed.
    expect(result.current.filterFor("country")).toEqual({ dimension: "deviceCategory", value: "mobile" });
    expect(result.current.selectedIn("country")).toBeNull();
  });

  it("toggles off when the same value is selected again", () => {
    const { result } = renderHook(() => useDrilldown());
    act(() => result.current.select("deviceCategory", "mobile"));
    act(() => result.current.select("deviceCategory", "mobile"));
    expect(result.current.filter).toBeNull();
  });

  it("replaces the filter when a different dimension is selected", () => {
    const { result } = renderHook(() => useDrilldown());
    act(() => result.current.select("deviceCategory", "mobile"));
    act(() => result.current.select("country", "Germany"));
    expect(result.current.filter).toEqual({ dimension: "country", value: "Germany" });
  });

  it("select(null) and clear() reset", () => {
    const { result } = renderHook(() => useDrilldown());
    act(() => result.current.select("country", "Germany"));
    act(() => result.current.select("country", null));
    expect(result.current.filter).toBeNull();
    act(() => result.current.select("country", "Germany"));
    act(() => result.current.clear());
    expect(result.current.filter).toBeNull();
  });
});

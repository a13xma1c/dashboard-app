import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { DashboardProvider } from "@/context/DashboardProvider";
import { useDashboard } from "@/hooks/useDashboard";
import { DEFAULT_DATE_RANGE } from "@/lib/dates";
import { DATE_RANGE_STORAGE_KEY, PROPERTY_STORAGE_KEY } from "@/lib/storage";

const wrapper = ({ children }: { children: ReactNode }) => <DashboardProvider>{children}</DashboardProvider>;

describe("DashboardProvider", () => {
  it("starts empty with the default range", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(result.current.propertyId).toBe("");
    expect(result.current.ready).toBe(false);
    expect(result.current.dateRange).toEqual(DEFAULT_DATE_RANGE);
  });

  it("trims and persists the property ID", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    act(() => result.current.setPropertyId("  42 "));
    expect(result.current.propertyId).toBe("42");
    expect(result.current.ready).toBe(true);
    expect(localStorage.getItem(PROPERTY_STORAGE_KEY)).toBe("42");
  });

  it("persists the date range", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });
    act(() => result.current.setDateRange({ start: "2025-01-01", end: "2025-01-31" }));
    expect(JSON.parse(localStorage.getItem(DATE_RANGE_STORAGE_KEY)!)).toEqual({ start: "2025-01-01", end: "2025-01-31" });
  });

  it("restores persisted state", () => {
    localStorage.setItem(PROPERTY_STORAGE_KEY, "999");
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify({ start: "6daysAgo", end: "today" }));
    const { result } = renderHook(() => useDashboard(), { wrapper });
    expect(result.current.propertyId).toBe("999");
    expect(result.current.dateRange).toEqual({ start: "6daysAgo", end: "today" });
  });

  it("ignores corrupt or invalid stored ranges", () => {
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, "{not json");
    expect(renderHook(() => useDashboard(), { wrapper }).result.current.dateRange).toEqual(DEFAULT_DATE_RANGE);

    localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify({ start: "nonsense", end: "today" }));
    expect(renderHook(() => useDashboard(), { wrapper }).result.current.dateRange).toEqual(DEFAULT_DATE_RANGE);
  });

  it("accepts initial overrides", () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: ({ children }) => (
        <DashboardProvider initialPropertyId="7" initialDateRange={{ start: "today", end: "today" }}>
          {children}
        </DashboardProvider>
      ),
    });
    expect(result.current.propertyId).toBe("7");
    expect(result.current.dateRange).toEqual({ start: "today", end: "today" });
  });
});

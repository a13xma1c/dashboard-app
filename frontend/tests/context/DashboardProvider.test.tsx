import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DashboardProvider } from "@/context/DashboardProvider";
import { useDashboard } from "@/hooks/useDashboard";
import { DEFAULT_DATE_RANGE } from "@/lib/dates";
import { DATE_RANGE_STORAGE_KEY, PROPERTY_STORAGE_KEY } from "@/lib/storage";

const makeWrapper =
  (route = "/dashboard/overview") =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <DashboardProvider>{children}</DashboardProvider>
    </MemoryRouter>
  );
const wrapper = makeWrapper();

/** Hook under test plus the current URL search string, for asserting URL sync. */
const useDashboardWithUrl = () => ({ ...useDashboard(), search: useLocation().search });

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
        <MemoryRouter>
          <DashboardProvider initialPropertyId="7" initialDateRange={{ start: "today", end: "today" }}>
            {children}
          </DashboardProvider>
        </MemoryRouter>
      ),
    });
    expect(result.current.propertyId).toBe("7");
    expect(result.current.dateRange).toEqual({ start: "today", end: "today" });
  });

  describe("URL sync", () => {
    it("reads property and range from the URL, taking precedence over storage", () => {
      localStorage.setItem(PROPERTY_STORAGE_KEY, "stored");
      const { result } = renderHook(() => useDashboardWithUrl(), {
        wrapper: makeWrapper("/dashboard/geography?property=555&start=6daysAgo&end=today"),
      });
      expect(result.current.propertyId).toBe("555");
      expect(result.current.dateRange).toEqual({ start: "6daysAgo", end: "today" });
    });

    it("ignores invalid URL dates", () => {
      const { result } = renderHook(() => useDashboardWithUrl(), {
        wrapper: makeWrapper("/dashboard/overview?start=yesterweek&end=today"),
      });
      expect(result.current.dateRange).toEqual(DEFAULT_DATE_RANGE);
    });

    it("writes state changes to the URL", () => {
      const { result } = renderHook(() => useDashboardWithUrl(), { wrapper });
      act(() => result.current.setPropertyId("42"));
      act(() => result.current.setDateRange({ start: "2025-03-01", end: "2025-03-14" }));
      const params = new URLSearchParams(result.current.search);
      expect(params.get("property")).toBe("42");
      expect(params.get("start")).toBe("2025-03-01");
      expect(params.get("end")).toBe("2025-03-14");
    });

    it("leaves redirecting paths alone so <Navigate> can win", () => {
      const { result } = renderHook(() => useDashboardWithUrl(), { wrapper: makeWrapper("/dashboard") });
      expect(result.current.search).toBe("");
      const unknown = renderHook(() => useDashboardWithUrl(), { wrapper: makeWrapper("/dashboard/nope") });
      expect(unknown.result.current.search).toBe("");
    });

    it("omits the property param while none is selected", () => {
      const { result } = renderHook(() => useDashboardWithUrl(), { wrapper });
      const params = new URLSearchParams(result.current.search);
      expect(params.has("property")).toBe(false);
      expect(params.get("start")).toBe(DEFAULT_DATE_RANGE.start);
    });
  });
});

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { DashboardProvider } from "@/context/DashboardProvider";
import { createTestQueryClient } from "@tests/helpers/render";
import { fetchCustomReport, fetchMetadata, fetchReport, fetchSummary, resetMockAnalytics } from "@tests/helpers/mockAnalytics";
import { useCustomReport, useMetadata, useReport, useSummary } from "@/hooks/useReport";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

function wrapper(propertyId = "123") {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      <DashboardProvider initialPropertyId={propertyId} initialDateRange={{ start: "2025-03-01", end: "2025-03-07" }}>
        {children}
      </DashboardProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => resetMockAnalytics());

describe("useReport", () => {
  it("fetches with property, date range and filter from context", async () => {
    const filter = { dimension: "deviceCategory", value: "mobile" };
    const { result } = renderHook(() => useReport("devices", { filter, limit: 5 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchReport).toHaveBeenCalledWith("devices", {
      propertyId: "123",
      startDate: "2025-03-01",
      endDate: "2025-03-07",
      filter,
      limit: 5,
    });
    expect(result.current.data?.headers[0]).toBe("deviceCategory");
  });

  it("is disabled without a property ID", async () => {
    const { result } = renderHook(() => useReport("devices"), { wrapper: wrapper("") });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchReport).not.toHaveBeenCalled();
  });

  it("honours enabled: false", async () => {
    const { result } = renderHook(() => useReport("devices", { enabled: false }), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("surfaces errors", async () => {
    fetchReport.mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useReport("devices"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("nope");
  });
});

describe("useReport placeholder data", () => {
  it("keeps previous data while a new filter loads", async () => {
    type Props = { filter: { dimension: string; value: string } | null };
    const initialProps: Props = { filter: null };
    const { result, rerender } = renderHook(({ filter }: Props) => useReport("devices", { filter }), {
      wrapper: wrapper(),
      initialProps,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const before = result.current.data;

    rerender({ filter: { dimension: "country", value: "Germany" } });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(before);

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data).not.toBe(before);
  });
});

describe("useSummary", () => {
  it("fetches the summary", async () => {
    const { result } = renderHook(() => useSummary(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(result.current.data?.current_range.start_date).toBe("2025-03-01");
  });
});

describe("useCustomReport", () => {
  it("fetches with the given fields", async () => {
    const { result } = renderHook(() => useCustomReport(["country"], ["sessions"], { limit: 3 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchCustomReport).toHaveBeenCalledWith(expect.objectContaining({ dimensions: ["country"], metrics: ["sessions"], limit: 3 }));
    expect(result.current.data?.rows).toHaveLength(3);
  });

  it("stays idle without metrics", async () => {
    const { result } = renderHook(() => useCustomReport(["country"], []), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchCustomReport).not.toHaveBeenCalled();
  });
});

describe("useMetadata", () => {
  it("fetches field metadata", async () => {
    const { result } = renderHook(() => useMetadata(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    expect(result.current.data?.metrics.some((m) => m.name === "sessions")).toBe(true);
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { describeAge, useLastUpdated } from "@/hooks/useLastUpdated";
import { createTestQueryClient } from "@tests/helpers/render";

describe("describeAge", () => {
  it("buckets durations", () => {
    expect(describeAge(0)).toBe("just now");
    expect(describeAge(44_000)).toBe("just now");
    expect(describeAge(120_000)).toBe("2 min ago");
    expect(describeAge(59 * 60_000)).toBe("59 min ago");
    expect(describeAge(60 * 60_000)).toBe("1 hour ago");
    expect(describeAge(3 * 60 * 60_000)).toBe("3 hours ago");
  });
});

describe("useLastUpdated", () => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const fetcher = vi.fn(async () => "data");

  beforeEach(() => {
    queryClient.clear();
    fetcher.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  function useSubject() {
    const report = useQuery({ queryKey: ["report", "x"], queryFn: fetcher });
    return { report, status: useLastUpdated(1_000) };
  }

  it("records when fetching settles and labels it", async () => {
    const { result } = renderHook(() => useSubject(), { wrapper });
    expect(result.current.status.isRefreshing).toBe(true);
    expect(result.current.status.label).toBeNull();
    await waitFor(() => expect(result.current.status.isRefreshing).toBe(false));
    await waitFor(() => expect(result.current.status.label).toBe("just now"));
    expect(result.current.status.updatedAt).not.toBeNull();
  });

  it("refresh() refetches report queries", async () => {
    const { result } = renderHook(() => useSubject(), { wrapper });
    await waitFor(() => expect(result.current.status.isRefreshing).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(() => result.current.status.refresh());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("ignores the auth query", async () => {
    const { result } = renderHook(
      () => {
        useQuery({ queryKey: ["auth", "me"], queryFn: async () => "me" });
        return useLastUpdated(1_000);
      },
      { wrapper }
    );
    await waitFor(() => expect(queryClient.getQueryData(["auth", "me"])).toBe("me"));
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.updatedAt).toBeNull();
  });
});

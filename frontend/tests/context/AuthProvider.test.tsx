import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { createTestQueryClient } from "@tests/helpers/render";
import { checkAuth, login, logout, mockApi, resetMockAnalytics } from "@tests/helpers/mockAnalytics";
import { UNAUTHORIZED_EVENT } from "@/api/client";

vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));

function setup() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(["report", "x"], { cached: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useAuth(), { wrapper }) };
}

beforeEach(() => resetMockAnalytics());

describe("AuthProvider", () => {
  it("starts loading, then reports the status", async () => {
    const { result } = setup();
    expect(result.current.authenticated).toBeNull();
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(result.current.mockMode).toBe(true);
    expect(result.current.email).toBeNull();
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });

  it("reports an authenticated session", async () => {
    await mockApi.login();
    const { result } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(true));
    expect(result.current.email).toBe("demo@example.com");
  });

  it("treats a failing status check as logged out", async () => {
    checkAuth.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(false));
  });

  it("login() refreshes the status", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    await act(() => result.current.login());
    await waitFor(() => expect(result.current.authenticated).toBe(true));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("logout() clears the session and cached reports", async () => {
    await mockApi.login();
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    await act(() => result.current.logout());

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(result.current.email).toBeNull();
    expect(result.current.mockMode).toBe(true); // preserved so the login page can show demo copy
    expect(queryClient.getQueryData(["report", "x"])).toBeUndefined();
  });

  it("signs out locally when the API reports an expired session", async () => {
    await mockApi.login();
    const { result, queryClient } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    act(() => window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT)));

    await waitFor(() => expect(result.current.authenticated).toBe(false));
    expect(result.current.mockMode).toBe(true);
    expect(queryClient.getQueryData(["report", "x"])).toBeUndefined();
  });

  it("refetch() re-queries the backend", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.authenticated).toBe(false));
    await mockApi.login();
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.authenticated).toBe(true));
    expect(checkAuth).toHaveBeenCalledTimes(2);
  });
});

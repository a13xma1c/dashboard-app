/**
 * Drop-in replacement for `src/api/analytics` used by component tests:
 *
 *   vi.mock("@/api/analytics", () => import("@tests/helpers/mockAnalytics"));
 *
 * Every function is a `vi.fn` wrapping the deterministic in-browser mock API
 * (with a frozen "today"), so tests can both rely on stable data and assert
 * on calls / inject failures with `mockRejectedValueOnce`.
 */
import { vi } from "vitest";
import { createMockApi } from "@/mocks/mockApi";

export const FIXED_TODAY = new Date(Date.UTC(2025, 2, 15)); // 2025-03-15

export const mockApi = createMockApi({ today: FIXED_TODAY, storage: sessionStorage });

export const fetchReport = vi.fn(mockApi.fetchReport);
export const fetchSummary = vi.fn(mockApi.fetchSummary);
export const fetchCustomReport = vi.fn(mockApi.fetchCustomReport);
export const fetchMetadata = vi.fn(mockApi.fetchMetadata);
export const checkAuth = vi.fn(mockApi.checkAuth);
export const logout = vi.fn(mockApi.logout);
export const login = vi.fn(mockApi.login);

/** Same behaviour as the real helper, minus the axios import. */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Failed to load data.";
}

/** Restore default implementations between tests. */
export function resetMockAnalytics() {
  fetchReport.mockReset().mockImplementation(mockApi.fetchReport);
  fetchSummary.mockReset().mockImplementation(mockApi.fetchSummary);
  fetchCustomReport.mockReset().mockImplementation(mockApi.fetchCustomReport);
  fetchMetadata.mockReset().mockImplementation(mockApi.fetchMetadata);
  checkAuth.mockReset().mockImplementation(mockApi.checkAuth);
  logout.mockReset().mockImplementation(mockApi.logout);
  login.mockReset().mockImplementation(mockApi.login);
}

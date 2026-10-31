import axios from "axios";
import api, { API_BASE_URL, USE_MOCK_API } from "./client";
import type {
  AuthStatus,
  CustomReportParams,
  MetadataResponse,
  ReportParams,
  ReportResponse,
  StandardReport,
  SummaryResponse,
} from "./types";

export type * from "./types";

/** Extract a human-readable message from an Axios error. */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (err.response?.status === 401) return "Session expired — please sign in again.";
    if (err.response?.status === 502) {
      return "Google Analytics API error — check your Property ID and permissions.";
    }
    if (!err.response) return "Could not reach the API — is the backend running?";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Failed to load data.";
}

function toQuery(params: ReportParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    start_date: params.startDate,
    end_date: params.endDate,
  };
  if (params.filter) {
    query.filter_dimension = params.filter.dimension;
    query.filter_value = params.filter.value;
  }
  if (params.limit) query.limit = params.limit;
  return query;
}

// ── Live implementation ───────────────────────────────────────────────────────

const live = {
  fetchReport(report: StandardReport, params: ReportParams): Promise<ReportResponse> {
    return api
      .get(`/analytics/${report}/${encodeURIComponent(params.propertyId)}`, { params: toQuery(params) })
      .then((r) => r.data);
  },

  fetchSummary(params: ReportParams): Promise<SummaryResponse> {
    return api
      .get(`/analytics/summary/${encodeURIComponent(params.propertyId)}`, { params: toQuery(params) })
      .then((r) => r.data);
  },

  fetchCustomReport(params: CustomReportParams): Promise<ReportResponse> {
    return api
      .get(`/analytics/custom/${encodeURIComponent(params.propertyId)}`, {
        params: {
          ...toQuery(params),
          dimensions: params.dimensions.join(","),
          metrics: params.metrics.join(","),
        },
      })
      .then((r) => r.data);
  },

  fetchMetadata(): Promise<MetadataResponse> {
    return api.get("/analytics/metadata").then((r) => r.data);
  },

  checkAuth(): Promise<AuthStatus> {
    return api.get("/auth/me").then((r) => r.data);
  },

  logout(): Promise<void> {
    return api.post("/auth/logout").then(() => undefined);
  },

  /** Start the OAuth flow. Navigates away, so the promise never meaningfully resolves. */
  login(): Promise<void> {
    window.location.assign(`${API_BASE_URL}/auth/login`);
    return Promise.resolve();
  },
};

export type AnalyticsApi = typeof live;

// ── Mock switch ───────────────────────────────────────────────────────────────
// When VITE_MOCK_API=true the whole API surface is served by src/mocks, so the
// UI can be developed and demoed with no backend at all.

async function resolveApi(): Promise<AnalyticsApi> {
  if (!USE_MOCK_API) return live;
  const { createMockApi } = await import("../mocks/mockApi");
  return createMockApi();
}

const apiPromise = resolveApi();

export const fetchReport = (report: StandardReport, params: ReportParams) =>
  apiPromise.then((a) => a.fetchReport(report, params));
export const fetchSummary = (params: ReportParams) => apiPromise.then((a) => a.fetchSummary(params));
export const fetchCustomReport = (params: CustomReportParams) =>
  apiPromise.then((a) => a.fetchCustomReport(params));
export const fetchMetadata = () => apiPromise.then((a) => a.fetchMetadata());
export const checkAuth = () => apiPromise.then((a) => a.checkAuth());
export const logout = () => apiPromise.then((a) => a.logout());
export const login = () => apiPromise.then((a) => a.login());

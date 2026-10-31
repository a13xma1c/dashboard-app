/**
 * An `AnalyticsApi` implementation backed entirely by the in-browser mock
 * generator. Used when `VITE_MOCK_API=true` and by the test suite.
 */
import type { AnalyticsApi } from "../api/analytics";
import type { CustomReportParams, ReportParams, StandardReport } from "../api/types";
import { METADATA, runMockReport, runMockSummary } from "./gaMock";

/** Dimension/metric pairs for each standard report — mirrors the backend router. */
export const STANDARD_REPORT_FIELDS: Record<StandardReport, { dimensions: string[]; metrics: string[] }> = {
  overview: {
    dimensions: ["date"],
    metrics: ["sessions", "totalUsers", "newUsers", "screenPageViews", "engagedSessions", "averageSessionDuration"],
  },
  "traffic-sources": { dimensions: ["sessionDefaultChannelGroup"], metrics: ["sessions", "totalUsers", "engagementRate"] },
  "source-medium": {
    dimensions: ["sessionSource", "sessionMedium"],
    metrics: ["sessions", "totalUsers", "newUsers", "engagementRate"],
  },
  "top-pages": { dimensions: ["pagePath"], metrics: ["screenPageViews", "sessions", "averageSessionDuration", "bounceRate"] },
  "landing-pages": { dimensions: ["landingPage"], metrics: ["sessions", "newUsers", "engagementRate", "conversions"] },
  devices: { dimensions: ["deviceCategory"], metrics: ["sessions", "totalUsers", "engagementRate"] },
  browsers: { dimensions: ["browser"], metrics: ["sessions", "totalUsers"] },
  "operating-systems": { dimensions: ["operatingSystem"], metrics: ["sessions", "totalUsers"] },
  "new-vs-returning": { dimensions: ["newVsReturning"], metrics: ["sessions", "totalUsers", "engagementRate"] },
  geo: { dimensions: ["country"], metrics: ["sessions", "totalUsers", "newUsers", "engagementRate"] },
  cities: { dimensions: ["city"], metrics: ["sessions", "totalUsers"] },
  events: { dimensions: ["eventName"], metrics: ["eventCount", "totalUsers"] },
  hourly: { dimensions: ["hour"], metrics: ["sessions", "totalUsers"] },
};

const AUTH_KEY = "ga_mock_authenticated";

export interface MockApiOptions {
  /** Fixed "today" so dates are stable (tests). Defaults to the real clock. */
  today?: Date;
  /** Simulated network latency in ms. */
  latency?: number;
  /** Storage used to remember the mock login. Defaults to sessionStorage. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

const delay = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export function createMockApi(options: MockApiOptions = {}): AnalyticsApi {
  const { today, latency = 0 } = options;
  const storage = options.storage ?? globalThis.sessionStorage;
  const now = () => today ?? new Date();

  const report = (p: ReportParams, dimensions: string[], metrics: string[]) =>
    runMockReport(
      {
        propertyId: p.propertyId,
        dimensions,
        metrics,
        startDate: p.startDate,
        endDate: p.endDate,
        filter: p.filter,
        limit: p.limit,
      },
      now()
    );

  return {
    async fetchReport(name: StandardReport, params: ReportParams) {
      await delay(latency);
      const fields = STANDARD_REPORT_FIELDS[name];
      return report(params, fields.dimensions, fields.metrics);
    },
    async fetchSummary(params: ReportParams) {
      await delay(latency);
      return runMockSummary(params.propertyId, params.startDate, params.endDate, params.filter, now());
    },
    async fetchCustomReport(params: CustomReportParams) {
      await delay(latency);
      return report(params, params.dimensions, params.metrics);
    },
    async fetchMetadata() {
      await delay(latency);
      return METADATA;
    },
    async checkAuth() {
      await delay(latency);
      const authenticated = storage.getItem(AUTH_KEY) === "true";
      return { authenticated, mock_mode: true, email: authenticated ? "demo@example.com" : null };
    },
    async logout() {
      await delay(latency);
      storage.removeItem(AUTH_KEY);
    },
    async login() {
      await delay(latency);
      storage.setItem(AUTH_KEY, "true");
    },
  };
}

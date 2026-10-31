import { beforeEach, describe, expect, it, vi } from "vitest";
import { STANDARD_REPORT_FIELDS, createMockApi } from "@/mocks/mockApi";
import type { StandardReport } from "@/api/types";

const TODAY = new Date(Date.UTC(2025, 2, 15));
const params = { propertyId: "1", startDate: "2025-03-01", endDate: "2025-03-07" };

describe("createMockApi", () => {
  let store: Map<string, string>;
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  beforeEach(() => {
    store = new Map();
  });

  it.each(Object.keys(STANDARD_REPORT_FIELDS) as StandardReport[])("fetchReport(%s) uses the right fields", async (name) => {
    const api = createMockApi({ today: TODAY, storage });
    const r = await api.fetchReport(name, params);
    const fields = STANDARD_REPORT_FIELDS[name];
    expect(r.headers).toEqual([...fields.dimensions, ...fields.metrics]);
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it("fetchSummary mirrors the backend", async () => {
    const api = createMockApi({ today: TODAY, storage });
    const s = await api.fetchSummary(params);
    expect(s.current_range).toEqual({ start_date: "2025-03-01", end_date: "2025-03-07" });
    expect(s.metrics).toContain("sessions");
  });

  it("fetchCustomReport passes fields through", async () => {
    const api = createMockApi({ today: TODAY, storage });
    const r = await api.fetchCustomReport({ ...params, dimensions: ["country"], metrics: ["sessions"], limit: 2 });
    expect(r.headers).toEqual(["country", "sessions"]);
    expect(r.rows).toHaveLength(2);
  });

  it("fetchMetadata returns the catalogue", async () => {
    const api = createMockApi({ today: TODAY, storage });
    const m = await api.fetchMetadata();
    expect(m.dimensions.length).toBeGreaterThan(5);
    expect(m.metrics.length).toBeGreaterThan(5);
  });

  it("login / checkAuth / logout round-trip through storage", async () => {
    const api = createMockApi({ today: TODAY, storage });
    expect(await api.checkAuth()).toEqual({ authenticated: false, mock_mode: true, email: null });
    await api.login();
    expect(await api.checkAuth()).toEqual({ authenticated: true, mock_mode: true, email: "demo@example.com" });
    await api.logout();
    expect((await api.checkAuth()).authenticated).toBe(false);
  });

  it("defaults to sessionStorage", async () => {
    const api = createMockApi({ today: TODAY });
    await api.login();
    expect(sessionStorage.getItem("ga_mock_authenticated")).toBe("true");
  });

  it("simulates latency", async () => {
    vi.useFakeTimers();
    const api = createMockApi({ today: TODAY, storage, latency: 500 });
    let done = false;
    void api.fetchMetadata().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it("uses the real clock when no today is given", async () => {
    const api = createMockApi({ storage });
    const r = await api.fetchReport("overview", { propertyId: "1", startDate: "today", endDate: "today" });
    const now = new Date();
    const expected = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
    expect(r.rows[0][0]).toBe(expected);
  });
});

import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/api/client";
import {
  checkAuth,
  extractErrorMessage,
  fetchCustomReport,
  fetchMetadata,
  fetchReport,
  fetchSummary,
  login,
  logout,
} from "@/api/analytics";

function axiosError(status?: number, data?: unknown) {
  const err = new AxiosError("boom", "ERR", undefined, undefined, status
    ? { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data }
    : undefined);
  return err;
}

describe("extractErrorMessage", () => {
  it("prefers the API's detail string", () => {
    expect(extractErrorMessage(axiosError(400, { detail: "Unsupported dimension" }))).toBe("Unsupported dimension");
  });

  it("maps well-known status codes", () => {
    expect(extractErrorMessage(axiosError(401, {}))).toMatch(/sign in again/);
    expect(extractErrorMessage(axiosError(502, {}))).toMatch(/Property ID/);
  });

  it("explains network failures", () => {
    expect(extractErrorMessage(axiosError())).toMatch(/backend running/);
  });

  it("falls back to Error.message and a generic string", () => {
    expect(extractErrorMessage(new Error("custom"))).toBe("custom");
    expect(extractErrorMessage("???")).toBe("Failed to load data.");
    expect(extractErrorMessage(axiosError(500, { detail: { nested: true } }))).toBe("boom");
  });
});

describe("live API calls", () => {
  afterEach(() => vi.restoreAllMocks());

  const params = { propertyId: "12 3", startDate: "7daysAgo", endDate: "today" };

  it("fetchReport builds the URL and query", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { headers: [], rows: [] } });
    await fetchReport("top-pages", { ...params, filter: { dimension: "country", value: "Germany" }, limit: 50 });
    expect(get).toHaveBeenCalledWith("/analytics/top-pages/12%203", {
      params: { start_date: "7daysAgo", end_date: "today", filter_dimension: "country", filter_value: "Germany", limit: 50 },
    });
  });

  it("fetchReport omits filter/limit when absent", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: {} });
    await fetchReport("geo", params);
    expect(get.mock.calls[0][1]).toEqual({ params: { start_date: "7daysAgo", end_date: "today" } });
  });

  it("fetchSummary hits the summary endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { metrics: [] } });
    await fetchSummary(params);
    expect(get.mock.calls[0][0]).toBe("/analytics/summary/12%203");
  });

  it("fetchCustomReport joins field lists", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: {} });
    await fetchCustomReport({ ...params, dimensions: ["date", "country"], metrics: ["sessions"] });
    expect(get.mock.calls[0][1]).toEqual({
      params: { start_date: "7daysAgo", end_date: "today", dimensions: "date,country", metrics: "sessions" },
    });
  });

  it("fetchMetadata / checkAuth / logout", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: { ok: true } });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    expect(await fetchMetadata()).toEqual({ ok: true });
    expect(await checkAuth()).toEqual({ ok: true });
    await logout();
    expect(get).toHaveBeenCalledWith("/analytics/metadata");
    expect(get).toHaveBeenCalledWith("/auth/me");
    expect(post).toHaveBeenCalledWith("/auth/logout");
  });

  it("login navigates to the backend OAuth entry point", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    await login();
    expect(assign).toHaveBeenCalledWith("http://localhost:8000/auth/login");
    vi.unstubAllGlobals();
  });
});

describe("VITE_MOCK_API=true", () => {
  it("routes every call through the in-browser mock API", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MOCK_API", "true");
    try {
      const mod = await import("@/api/analytics");
      const client = await import("@/api/client");
      expect(client.USE_MOCK_API).toBe(true);

      const get = vi.spyOn(client.default, "get");
      expect((await mod.checkAuth()).authenticated).toBe(false);
      await mod.login();
      expect((await mod.checkAuth()).authenticated).toBe(true);
      const report = await mod.fetchReport("devices", { propertyId: "1", startDate: "7daysAgo", endDate: "today" });
      expect(report.headers[0]).toBe("deviceCategory");
      expect((await mod.fetchMetadata()).metrics.length).toBeGreaterThan(0);
      expect((await mod.fetchSummary({ propertyId: "1", startDate: "7daysAgo", endDate: "today" })).current.sessions).toBeGreaterThan(0);
      expect((await mod.fetchCustomReport({ propertyId: "1", startDate: "7daysAgo", endDate: "today", dimensions: [], metrics: ["sessions"] })).rows).toHaveLength(1);
      await mod.logout();
      expect((await mod.checkAuth()).authenticated).toBe(false);
      expect(get).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

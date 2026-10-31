import { expect, test } from "@playwright/test";
import { BACKEND_URL } from "./helpers";

/**
 * Contract checks straight against the running backend — the same server the
 * UI tests use — to make sure the frontend's assumptions about the API hold.
 */
test.describe("backend API contract", () => {
  test("health reports mock mode", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", version: expect.any(String), mock_mode: true });
    expect(body.cache).toMatchObject({ enabled: true, reachable: true });
    expect(["memory", "redis"]).toContain(body.cache.backend);
  });

  test("analytics endpoints require a session", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/analytics/overview/1`);
    expect(res.status()).toBe(401);
  });

  test("login sets a session cookie that unlocks reports", async ({ request }) => {
    const login = await request.get(`${BACKEND_URL}/auth/login`, { maxRedirects: 0 });
    expect(login.status()).toBe(307);
    expect(login.headers()["location"]).toMatch(/\/dashboard$/);

    const me = await request.get(`${BACKEND_URL}/auth/me`);
    expect(await me.json()).toEqual({ authenticated: true, mock_mode: true, email: "demo@example.com" });

    const summary = await request.get(`${BACKEND_URL}/analytics/summary/123?start_date=7daysAgo`);
    expect(summary.ok()).toBe(true);
    const body = await summary.json();
    expect(body.metrics).toContain("sessions");
    expect(body.current.sessions).toBeGreaterThan(0);
    expect(body.previous.sessions).toBeGreaterThan(0);

    const overview = await request.get(`${BACKEND_URL}/analytics/overview/123?start_date=2025-03-01&end_date=2025-03-03`);
    const report = await overview.json();
    expect(report.headers[0]).toBe("date");
    expect(report.rows.map((r: string[]) => r[0])).toEqual(["20250301", "20250302", "20250303"]);

    await request.post(`${BACKEND_URL}/auth/logout`);
    expect((await (await request.get(`${BACKEND_URL}/auth/me`)).json()).authenticated).toBe(false);
  });

  test("repeat report requests are served from the cache", async ({ request }) => {
    await request.get(`${BACKEND_URL}/auth/login`, { maxRedirects: 0 });
    const before = (await (await request.get(`${BACKEND_URL}/health`)).json()).cache.hits as number;
    const url = `${BACKEND_URL}/analytics/devices/424242?start_date=2025-03-01&end_date=2025-03-07`;
    const first = await (await request.get(url)).json();
    const second = await (await request.get(url)).json();
    expect(second).toEqual(first);
    const after = (await (await request.get(`${BACKEND_URL}/health`)).json()).cache.hits as number;
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });

  test("rejects bad input with helpful errors", async ({ request }) => {
    await request.get(`${BACKEND_URL}/auth/login`, { maxRedirects: 0 });
    const bad = await request.get(`${BACKEND_URL}/analytics/overview/123?start_date=lastTuesday`);
    expect(bad.status()).toBe(400);
    expect((await bad.json()).detail).toMatch(/Invalid date/);

    const custom = await request.get(`${BACKEND_URL}/analytics/custom/123?dimensions=galaxy`);
    expect(custom.status()).toBe(400);
    expect((await custom.json()).detail).toMatch(/Unsupported dimension/);
  });
});

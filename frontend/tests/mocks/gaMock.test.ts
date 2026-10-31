import { describe, expect, it } from "vitest";
import {
  CATEGORICAL_DIMENSIONS,
  DERIVED_DIMENSIONS,
  InvalidDateError,
  METADATA,
  PARENT_OF,
  SUPPORTED_DIMENSIONS,
  SUPPORTED_METRICS,
  UnsupportedFieldError,
  eachDay,
  gaDate,
  resolveDate,
  runMockReport,
  runMockSummary,
} from "@/mocks/gaMock";

const TODAY = new Date(Date.UTC(2025, 2, 15));
const PID = "123456789";

const sum = (rows: string[][], col: number) => rows.reduce((s, r) => s + Number(r[col]), 0);
const run = (dimensions: string[], metrics: string[], extra: Partial<Parameters<typeof runMockReport>[0]> = {}) =>
  runMockReport({ propertyId: PID, dimensions, metrics, ...extra }, TODAY);

describe("resolveDate", () => {
  it("handles GA relative syntax", () => {
    expect(gaDate(resolveDate("today", TODAY))).toBe("20250315");
    expect(gaDate(resolveDate("yesterday", TODAY))).toBe("20250314");
    expect(gaDate(resolveDate("7daysAgo", TODAY))).toBe("20250308");
    expect(gaDate(resolveDate("2025-01-31", TODAY))).toBe("20250131");
  });

  it("rejects garbage", () => {
    for (const bad of ["", "tomorrow", "2025-02-30", "20250101"]) {
      expect(() => resolveDate(bad, TODAY)).toThrow(InvalidDateError);
    }
  });
});

describe("eachDay", () => {
  it("is inclusive", () => {
    const days = [...eachDay(resolveDate("2025-03-01", TODAY), resolveDate("2025-03-03", TODAY))].map(gaDate);
    expect(days).toEqual(["20250301", "20250302", "20250303"]);
  });
});

describe("runMockReport — shape", () => {
  it("returns headers = dimensions + metrics with string cells", () => {
    const r = run(["country"], ["sessions", "totalUsers"]);
    expect(r.headers).toEqual(["country", "sessions", "totalUsers"]);
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row).toHaveLength(3);
      row.forEach((c) => expect(typeof c).toBe("string"));
    }
  });

  it("produces one row per day in order for the date dimension", () => {
    const r = run(["date"], ["sessions"], { startDate: "2025-03-01", endDate: "2025-03-05" });
    expect(r.rows.map((x) => x[0])).toEqual(["20250301", "20250302", "20250303", "20250304", "20250305"]);
  });

  it("defaults to the last 30 days", () => {
    const r = run(["date"], ["sessions"]);
    expect(r.rows).toHaveLength(31);
    expect(r.rows.at(-1)?.[0]).toBe("20250315");
  });

  it("sorts categorical rows by the first metric descending", () => {
    const values = run(["country"], ["sessions"]).rows.map((r) => Number(r[1]));
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it("returns a single totals row with no dimensions", () => {
    const r = run([], ["sessions"]);
    expect(r.headers).toEqual(["sessions"]);
    expect(r.rows).toHaveLength(1);
  });

  it("applies the limit", () => {
    expect(run(["country"], ["sessions"], { limit: 3 }).rows).toHaveLength(3);
  });

  it("formats integer metrics as whole numbers and rates as fractions", () => {
    const r = run(["deviceCategory"], ["sessions", "engagementRate", "bounceRate"]);
    for (const [, sessions, er, br] of r.rows) {
      expect(sessions).toMatch(/^\d+$/);
      expect(Number(er)).toBeGreaterThan(0);
      expect(Number(er)).toBeLessThan(1);
      expect(Number(er) + Number(br)).toBeCloseTo(1, 5);
    }
  });

  it("produces cartesian products for multiple dimensions", () => {
    const r = run(["deviceCategory", "newVsReturning"], ["sessions"]);
    expect(r.rows).toHaveLength(CATEGORICAL_DIMENSIONS.deviceCategory.length * CATEGORICAL_DIMENSIONS.newVsReturning.length);
  });
});

describe("runMockReport — determinism & consistency", () => {
  it("is deterministic", () => {
    expect(run(["date", "deviceCategory"], ["sessions", "engagementRate"])).toEqual(
      run(["date", "deviceCategory"], ["sessions", "engagementRate"])
    );
  });

  it("differs between properties", () => {
    const a = runMockReport({ propertyId: "1", dimensions: ["date"], metrics: ["sessions"] }, TODAY);
    const b = runMockReport({ propertyId: "2", dimensions: ["date"], metrics: ["sessions"] }, TODAY);
    expect(a).not.toEqual(b);
  });

  it("breakdowns sum to the time-series total (within rounding)", () => {
    const total = sum(run(["date"], ["sessions"]).rows, 1);
    for (const dim of ["deviceCategory", "sessionDefaultChannelGroup", "country", "pagePath"]) {
      const rows = run([dim], ["sessions"]).rows;
      expect(Math.abs(sum(rows, 1) - total)).toBeLessThanOrEqual(rows.length);
    }
  });

  it("a filtered series matches the corresponding breakdown row", () => {
    const devices = run(["deviceCategory"], ["sessions"]).rows;
    const mobile = Number(devices.find((r) => r[0] === "mobile")![1]);
    const filtered = run(["date"], ["sessions"], { filter: { dimension: "deviceCategory", value: "mobile" } }).rows;
    expect(Math.abs(sum(filtered, 1) - mobile)).toBeLessThanOrEqual(filtered.length);
  });

  it("filter on an unknown value yields no rows", () => {
    expect(run(["date"], ["sessions"], { filter: { dimension: "deviceCategory", value: "fridge" } }).rows).toEqual([]);
  });

  it("filter on a derived dimension", () => {
    const r = run(["date"], ["sessions"], { filter: { dimension: "date", value: "20250310" } });
    expect(r.rows.map((x) => x[0])).toEqual(["20250310"]);
  });

  it("filter on the same dimension returns only that value", () => {
    const all = run(["deviceCategory"], ["sessions"]).rows;
    const only = run(["deviceCategory"], ["sessions"], { filter: { dimension: "deviceCategory", value: "tablet" } }).rows;
    expect(only).toEqual([all.find((r) => r[0] === "tablet")]);
  });

  it("users never exceed sessions", () => {
    for (const [, s, u, n] of run(["date"], ["sessions", "totalUsers", "newUsers"]).rows) {
      expect(Number(n)).toBeLessThanOrEqual(Number(u));
      expect(Number(u)).toBeLessThanOrEqual(Number(s));
    }
  });

  it("weekends are quieter on average", () => {
    const rows = run(["date"], ["sessions"], { startDate: "2025-01-01", endDate: "2025-03-15" }).rows;
    const weekend: number[] = [];
    const weekday: number[] = [];
    for (const [raw, s] of rows) {
      const d = new Date(Date.UTC(+raw.slice(0, 4), +raw.slice(4, 6) - 1, +raw.slice(6)));
      (d.getUTCDay() === 0 || d.getUTCDay() === 6 ? weekend : weekday).push(Number(s));
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(weekend)).toBeLessThan(avg(weekday));
  });
});

describe("runMockReport — hierarchy (city → country)", () => {
  it("cities filtered by country sum to the country total", () => {
    const geo = run(["country"], ["sessions"]).rows;
    const germany = Number(geo.find((r) => r[0] === "Germany")![1]);
    const cities = run(["city"], ["sessions"], { filter: { dimension: "country", value: "Germany" } }).rows;
    expect(new Set(cities.map((r) => r[0]))).toEqual(new Set(["Berlin", "Munich", "Hamburg"]));
    expect(Math.abs(sum(cities, 1) - germany)).toBeLessThanOrEqual(cities.length);
  });

  it("country × city only pairs compatible values", () => {
    const rows = run(["country", "city"], ["sessions"]).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const [country, city] of rows) expect(PARENT_OF.city[city]).toBe(country);
  });

  it("a city filter narrows the country dimension", () => {
    expect(run(["country"], ["sessions"], { filter: { dimension: "city", value: "Berlin" } }).rows.map((r) => r[0])).toEqual(["Germany"]);
  });
});

describe("runMockReport — derived dimensions", () => {
  it("dayOfWeek uses GA convention (0 = Sunday)", () => {
    // 2025-03-09 is a Sunday
    const r = run(["dayOfWeek"], ["sessions"], { startDate: "2025-03-09", endDate: "2025-03-09" });
    expect(r.rows[0][0]).toBe("0");
  });

  it("yearMonth groups months", () => {
    const r = run(["yearMonth"], ["sessions"], { startDate: "2025-02-20", endDate: "2025-03-05" });
    expect(r.rows.map((x) => x[0])).toEqual(["202502", "202503"]);
  });

  it("hour has 24 buckets", () => {
    expect(run(["hour"], ["sessions"]).rows).toHaveLength(24);
  });

  it.each([...SUPPORTED_DIMENSIONS])("dimension %s produces rows", (dim) => {
    const r = run([dim], ["sessions"], { startDate: "7daysAgo", endDate: "today" });
    expect(r.rows.length).toBeGreaterThan(0);
    if (dim in DERIVED_DIMENSIONS) expect(r.rows.map((x) => x[0])).toEqual([...r.rows.map((x) => x[0])].sort());
  });

  it.each([...SUPPORTED_METRICS])("metric %s produces numeric values", (metric) => {
    for (const row of run(["deviceCategory"], [metric]).rows) expect(Number(row[1])).toBeGreaterThanOrEqual(0);
  });
});

describe("runMockReport — validation", () => {
  it("rejects unknown fields", () => {
    expect(() => run(["nope"], ["sessions"])).toThrow(UnsupportedFieldError);
    expect(() => run(["date"], ["nope"])).toThrow(UnsupportedFieldError);
    expect(() => run(["date"], [])).toThrow(UnsupportedFieldError);
    expect(() => run(["date"], ["sessions"], { filter: { dimension: "nope", value: "x" } })).toThrow(UnsupportedFieldError);
  });

  it("rejects bad or inverted dates", () => {
    expect(() => run(["date"], ["sessions"], { startDate: "bad" })).toThrow(InvalidDateError);
    expect(() => run(["date"], ["sessions"], { startDate: "today", endDate: "yesterday" })).toThrow(/must not be after/);
  });
});

describe("runMockSummary", () => {
  it("returns adjacent, equal-length periods", () => {
    const s = runMockSummary(PID, "2025-03-08", "2025-03-14", null, TODAY);
    expect(s.current_range).toEqual({ start_date: "2025-03-08", end_date: "2025-03-14" });
    expect(s.previous_range).toEqual({ start_date: "2025-03-01", end_date: "2025-03-07" });
    expect(s.current.sessions).toBeGreaterThan(0);
    expect(s.previous.sessions).toBeGreaterThan(0);
    expect(s.current.engagementRate).toBeGreaterThan(0);
    expect(s.current.engagementRate).toBeLessThan(1);
  });

  it("matches the overview total", () => {
    const s = runMockSummary(PID, "2025-03-01", "2025-03-14", null, TODAY);
    const rows = run(["date"], ["sessions"], { startDate: "2025-03-01", endDate: "2025-03-14" }).rows;
    expect(Math.abs(s.current.sessions - sum(rows, 1))).toBeLessThanOrEqual(rows.length);
  });

  it("respects a filter", () => {
    const all = runMockSummary(PID, "7daysAgo", "today", null, TODAY);
    const mobile = runMockSummary(PID, "7daysAgo", "today", { dimension: "deviceCategory", value: "mobile" }, TODAY);
    expect(mobile.current.sessions).toBeLessThan(all.current.sessions);
  });

  it("returns zeros when the filter matches nothing", () => {
    const s = runMockSummary(PID, "7daysAgo", "today", { dimension: "country", value: "Atlantis" }, TODAY);
    expect(s.current.sessions).toBe(0);
  });
});

describe("METADATA", () => {
  it("covers every supported field", () => {
    expect(new Set(METADATA.dimensions.map((d) => d.name))).toEqual(SUPPORTED_DIMENSIONS);
    expect(new Set(METADATA.metrics.map((m) => m.name))).toEqual(SUPPORTED_METRICS);
  });
});

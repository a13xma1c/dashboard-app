import { describe, expect, it } from "vitest";
import {
  columnIndex,
  dimensionLabel,
  metricLabel,
  metricType,
  relativeChange,
  reportRowKey,
  sumColumn,
  toBreakdown,
  toNumber,
  toObjects,
  toSeries,
} from "@/lib/report";
import { makeReport } from "@tests/helpers/render";

const report = makeReport(
  ["country", "sessions", "engagementRate"],
  [
    ["Germany", 100, 0.5],
    ["France", 300, 0.6],
    ["Spain", 50, 0.7],
    ["Italy", 50, 0.4],
  ]
);

describe("toObjects", () => {
  it("zips headers and rows", () => {
    expect(toObjects(report)[0]).toEqual({ country: "Germany", sessions: "100", engagementRate: "0.5" });
  });

  it("fills missing cells with empty strings", () => {
    expect(toObjects({ headers: ["a", "b"], rows: [["1"]] })).toEqual([{ a: "1", b: "" }]);
  });
});

describe("toNumber", () => {
  it("parses strings and passes numbers through", () => {
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber(3)).toBe(3);
  });

  it("returns 0 for garbage", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });
});

describe("columnIndex / sumColumn", () => {
  it("finds columns", () => {
    expect(columnIndex(report, "sessions")).toBe(1);
    expect(columnIndex(report, "nope")).toBe(-1);
  });

  it("sums a column", () => {
    expect(sumColumn(report, "sessions")).toBe(500);
    expect(sumColumn(report, "nope")).toBe(0);
  });
});

describe("toBreakdown", () => {
  it("sorts descending and computes shares", () => {
    const items = toBreakdown(report, "country", "sessions");
    expect(items.map((i) => i.name)).toEqual(["France", "Germany", "Spain", "Italy"]);
    expect(items[0].share).toBeCloseTo(0.6);
    expect(items.reduce((s, i) => s + i.share, 0)).toBeCloseTo(1);
  });

  it("collapses the tail into Other", () => {
    const items = toBreakdown(report, "country", "sessions", { maxItems: 3 });
    expect(items.map((i) => i.name)).toEqual(["France", "Germany", "Other"]);
    expect(items[2].value).toBe(100);
    expect(items[2].share).toBeCloseTo(0.2);
  });

  it("uses a custom other label", () => {
    const items = toBreakdown(report, "country", "sessions", { maxItems: 2, otherLabel: "Rest" });
    expect(items[1].name).toBe("Rest");
  });

  it("returns [] for unknown columns", () => {
    expect(toBreakdown(report, "nope", "sessions")).toEqual([]);
    expect(toBreakdown(report, "country", "nope")).toEqual([]);
  });

  it("handles zero totals", () => {
    const zero = makeReport(["d", "m"], [["a", 0]]);
    expect(toBreakdown(zero, "d", "m")[0].share).toBe(0);
  });
});

describe("toSeries", () => {
  it("sorts by x and parses metrics", () => {
    const r = makeReport(["date", "sessions", "totalUsers"], [["20250302", 5, 4], ["20250301", 3, 2]]);
    expect(toSeries(r)).toEqual([
      { x: "20250301", sessions: 3, totalUsers: 2 },
      { x: "20250302", sessions: 5, totalUsers: 4 },
    ]);
  });

  it("supports a custom x header", () => {
    const r = makeReport(["sessions", "hour"], [[5, "02"], [3, "01"]]);
    expect(toSeries(r, "hour")).toEqual([
      { x: "01", sessions: 3 },
      { x: "02", sessions: 5 },
    ]);
  });

  it("returns [] when the x header is missing", () => {
    expect(toSeries(report, "nope")).toEqual([]);
  });
});

describe("relativeChange", () => {
  it("computes relative change", () => {
    expect(relativeChange(110, 100)).toBeCloseTo(0.1);
    expect(relativeChange(90, 100)).toBeCloseTo(-0.1);
  });

  it("handles a zero baseline", () => {
    expect(relativeChange(5, 0)).toBe(1);
    expect(relativeChange(0, 0)).toBe(0);
  });
});

describe("labels & types", () => {
  it("knows common metrics and falls back gracefully", () => {
    expect(metricType("engagementRate")).toBe("percent");
    expect(metricType("averageSessionDuration")).toBe("seconds");
    expect(metricType("unknownMetric")).toBe("integer");
    expect(metricLabel("totalUsers")).toBe("Users");
    expect(metricLabel("customThing")).toBe("customThing");
    expect(dimensionLabel("pagePath")).toBe("Page");
    expect(dimensionLabel("customDim")).toBe("customDim");
  });
});

describe("reportRowKey", () => {
  it("joins the dimension values", () => {
    const key = reportRowKey(["a", "b", "m"], 2);
    expect(key({ a: "x", b: "y", m: "1" })).toBe("x\u0000y");
  });
});

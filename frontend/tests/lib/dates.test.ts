import { describe, expect, it } from "vitest";
import {
  DATE_PRESETS,
  DEFAULT_DATE_RANGE,
  describeRange,
  isGaDate,
  isIsoDate,
  presetForRange,
  toIsoDate,
  validateRange,
} from "@/lib/dates";

const TODAY = new Date(2025, 2, 15); // local 2025-03-15

describe("presets", () => {
  it("default range is a preset", () => {
    expect(presetForRange(DEFAULT_DATE_RANGE)?.id).toBe("30d");
  });

  it("finds presets by range and returns undefined otherwise", () => {
    expect(presetForRange({ start: "6daysAgo", end: "today" })?.id).toBe("7d");
    expect(presetForRange({ start: "2025-01-01", end: "today" })).toBeUndefined();
  });

  it("every preset is valid", () => {
    for (const p of DATE_PRESETS) expect(validateRange(p.range, TODAY)).toBeNull();
  });
});

describe("isGaDate / isIsoDate", () => {
  it("accepts GA syntax", () => {
    expect(isGaDate("today")).toBe(true);
    expect(isGaDate("yesterday")).toBe(true);
    expect(isGaDate("7daysAgo")).toBe(true);
    expect(isGaDate("2025-02-28")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isGaDate("tomorrow")).toBe(false);
    expect(isGaDate("2025-02-30")).toBe(false);
    expect(isIsoDate("2025-13-01")).toBe(false);
    expect(isIsoDate("20250101")).toBe(false);
  });
});

describe("toIsoDate", () => {
  it("resolves relative dates against today", () => {
    expect(toIsoDate("today", TODAY)).toBe("2025-03-15");
    expect(toIsoDate("yesterday", TODAY)).toBe("2025-03-14");
    expect(toIsoDate("14daysAgo", TODAY)).toBe("2025-03-01");
  });

  it("passes ISO dates through", () => {
    expect(toIsoDate("2025-01-31", TODAY)).toBe("2025-01-31");
  });
});

describe("describeRange", () => {
  it("uses the preset label when available", () => {
    expect(describeRange({ start: "29daysAgo", end: "today" })).toBe("Last 30 days");
  });

  it("formats custom ranges", () => {
    expect(describeRange({ start: "2025-03-01", end: "2025-03-14" }, TODAY)).toBe("Mar 1, 2025 – Mar 14, 2025");
  });
});

describe("validateRange", () => {
  it("accepts valid ranges", () => {
    expect(validateRange({ start: "2025-03-01", end: "2025-03-14" }, TODAY)).toBeNull();
    expect(validateRange({ start: "2025-03-15", end: "2025-03-15" }, TODAY)).toBeNull();
  });

  it("rejects malformed dates", () => {
    expect(validateRange({ start: "nope", end: "today" }, TODAY)).toMatch(/valid dates/);
  });

  it("rejects inverted ranges", () => {
    expect(validateRange({ start: "2025-03-10", end: "2025-03-01" }, TODAY)).toMatch(/before end/);
  });

  it("rejects future end dates", () => {
    expect(validateRange({ start: "2025-03-01", end: "2025-03-16" }, TODAY)).toMatch(/future/);
  });
});

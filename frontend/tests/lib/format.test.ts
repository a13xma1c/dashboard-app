import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatDayOfWeek,
  formatDecimal,
  formatDelta,
  formatDimensionValue,
  formatDuration,
  formatGaDate,
  formatHour,
  formatInteger,
  formatIsoDate,
  formatMetric,
  formatPercent,
  gaDateToIso,
} from "@/lib/format";

describe("number formatting", () => {
  it("formats integers with separators", () => {
    expect(formatInteger(1234567)).toBe("1,234,567");
    expect(formatInteger(12.6)).toBe("13");
    expect(formatInteger(NaN)).toBe("–");
  });

  it("formats compact numbers", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(1500)).toBe("1.5K");
    expect(formatCompact(2_300_000)).toBe("2.3M");
    expect(formatCompact(Infinity)).toBe("–");
  });

  it("formats decimals", () => {
    expect(formatDecimal(2.345)).toBe("2.35");
    expect(formatDecimal(2)).toBe("2");
  });

  it("formats percentages from fractions", () => {
    expect(formatPercent(0.6123)).toBe("61.2%");
    expect(formatPercent(0.6123, 0)).toBe("61%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(NaN)).toBe("–");
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m 00s");
    expect(formatDuration(125.4)).toBe("2m 05s");
    expect(formatDuration(3725)).toBe("1h 02m");
    expect(formatDuration(-1)).toBe("–");
    expect(formatDuration(NaN)).toBe("–");
  });

  it("formats by metric type", () => {
    expect(formatMetric(0.5, "percent")).toBe("50.0%");
    expect(formatMetric(90, "seconds")).toBe("1m 30s");
    expect(formatMetric(1.234, "float")).toBe("1.23");
    expect(formatMetric(1234, "integer")).toBe("1,234");
  });

  it("formats signed deltas", () => {
    expect(formatDelta(0.1234)).toBe("+12.3%");
    expect(formatDelta(-0.05)).toBe("-5.0%");
    expect(formatDelta(0)).toBe("0.0%");
    expect(formatDelta(NaN)).toBe("–");
  });
});

describe("date formatting", () => {
  it("formats GA dates", () => {
    expect(formatGaDate("20250305")).toBe("Mar 5");
    expect(formatGaDate("20250305", true)).toBe("Mar 5, 2025");
    expect(formatGaDate("not-a-date")).toBe("not-a-date");
    expect(formatGaDate("20251305")).toBe("20251305");
  });

  it("converts GA dates to ISO", () => {
    expect(gaDateToIso("20250305")).toBe("2025-03-05");
    expect(gaDateToIso("abc")).toBe("abc");
  });

  it("formats ISO dates", () => {
    expect(formatIsoDate("2025-03-05")).toBe("Mar 5, 2025");
    expect(formatIsoDate("garbage")).toBe("garbage");
  });

  it("formats day of week using the GA convention (0 = Sunday)", () => {
    expect(formatDayOfWeek("0")).toBe("Sun");
    expect(formatDayOfWeek("6")).toBe("Sat");
    expect(formatDayOfWeek("7")).toBe("7");
    expect(formatDayOfWeek("x")).toBe("x");
  });

  it("formats hours", () => {
    expect(formatHour("00")).toBe("12am");
    expect(formatHour("09")).toBe("9am");
    expect(formatHour("12")).toBe("12pm");
    expect(formatHour("23")).toBe("11pm");
    expect(formatHour("24")).toBe("24");
  });

  it("formats any dimension value", () => {
    expect(formatDimensionValue("date", "20250101")).toBe("Jan 1");
    expect(formatDimensionValue("dayOfWeek", "1")).toBe("Mon");
    expect(formatDimensionValue("hour", "14")).toBe("2pm");
    expect(formatDimensionValue("yearMonth", "202503")).toBe("Mar 2025");
    expect(formatDimensionValue("yearMonth", "bad")).toBe("bad");
    expect(formatDimensionValue("month", "03")).toBe("Mar");
    expect(formatDimensionValue("month", "13")).toBe("13");
    expect(formatDimensionValue("country", "Germany")).toBe("Germany");
  });
});

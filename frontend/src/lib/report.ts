/**
 * Helpers for turning GA's columnar `{headers, rows}` payload into shapes the
 * widgets can consume (objects, numbers, aggregates).
 */
import type { MetricType, ReportResponse } from "../api/types";

export type ReportRow = Record<string, string>;

/** Convert a report to an array of `{header: value}` objects. */
export function toObjects(report: ReportResponse): ReportRow[] {
  return report.rows.map((row) => Object.fromEntries(report.headers.map((h, i) => [h, row[i] ?? ""])));
}

/** Parse a GA metric string; non-numeric → 0. */
export function toNumber(value: string | number | undefined | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Index of a header, or -1. */
export function columnIndex(report: ReportResponse, header: string): number {
  return report.headers.indexOf(header);
}

/** Sum a metric column across all rows. */
export function sumColumn(report: ReportResponse, header: string): number {
  const idx = columnIndex(report, header);
  if (idx < 0) return 0;
  return report.rows.reduce((acc, row) => acc + toNumber(row[idx]), 0);
}

/** Row identity for tables = the joined dimension values. */
export const reportRowKey = (headers: string[], dimensionCount: number) => (row: ReportRow) =>
  headers.slice(0, dimensionCount).map((h) => row[h]).join("\u0000");

export interface BreakdownItem {
  name: string;
  value: number;
  share: number;
}

/**
 * A single-dimension, single-metric breakdown (for pies / bars), sorted desc.
 * Optionally collapses the tail into an "Other" bucket so pies stay readable.
 */
export function toBreakdown(
  report: ReportResponse,
  dimension: string,
  metric: string,
  { maxItems = Infinity, otherLabel = "Other" } = {}
): BreakdownItem[] {
  const dIdx = columnIndex(report, dimension);
  const mIdx = columnIndex(report, metric);
  if (dIdx < 0 || mIdx < 0) return [];

  const items = report.rows
    .map((row) => ({ name: row[dIdx], value: toNumber(row[mIdx]) }))
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((s, i) => s + i.value, 0);

  let kept = items;
  if (items.length > maxItems) {
    const head = items.slice(0, maxItems - 1);
    const tail = items.slice(maxItems - 1);
    kept = [...head, { name: otherLabel, value: tail.reduce((s, i) => s + i.value, 0) }];
  }

  return kept.map((i) => ({ ...i, share: total ? i.value / total : 0 }));
}

export interface SeriesPoint {
  /** Raw x value (GA date string, hour, …). */
  x: string;
  [metric: string]: string | number;
}

/** Rows keyed by the first dimension with all metric columns parsed to numbers. */
export function toSeries(report: ReportResponse, xHeader: string = report.headers[0]): SeriesPoint[] {
  const xIdx = columnIndex(report, xHeader);
  if (xIdx < 0) return [];
  return [...report.rows]
    .sort((a, b) => a[xIdx].localeCompare(b[xIdx]))
    .map((row) => {
      const point: SeriesPoint = { x: row[xIdx] };
      report.headers.forEach((h, i) => {
        if (i !== xIdx) point[h] = toNumber(row[i]);
      });
      return point;
    });
}

/** Relative change from `previous` to `current`; 0 when previous is 0. */
export function relativeChange(current: number, previous: number): number {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}

/** Known metric types — used when the metadata endpoint isn't available. */
export const METRIC_TYPES: Record<string, MetricType> = {
  sessions: "integer",
  totalUsers: "integer",
  activeUsers: "integer",
  newUsers: "integer",
  screenPageViews: "integer",
  engagedSessions: "integer",
  eventCount: "integer",
  conversions: "integer",
  keyEvents: "integer",
  userEngagementDuration: "seconds",
  averageSessionDuration: "seconds",
  engagementRate: "percent",
  bounceRate: "percent",
  screenPageViewsPerSession: "float",
  eventsPerSession: "float",
  sessionsPerUser: "float",
};

export const METRIC_LABELS: Record<string, string> = {
  sessions: "Sessions",
  totalUsers: "Users",
  activeUsers: "Active users",
  newUsers: "New users",
  screenPageViews: "Views",
  engagedSessions: "Engaged sessions",
  eventCount: "Events",
  conversions: "Conversions",
  keyEvents: "Key events",
  userEngagementDuration: "Engagement duration",
  averageSessionDuration: "Avg. session duration",
  engagementRate: "Engagement rate",
  bounceRate: "Bounce rate",
  screenPageViewsPerSession: "Views / session",
  eventsPerSession: "Events / session",
  sessionsPerUser: "Sessions / user",
};

export const DIMENSION_LABELS: Record<string, string> = {
  date: "Date",
  dayOfWeek: "Day of week",
  month: "Month",
  year: "Year",
  yearMonth: "Month",
  hour: "Hour",
  sessionDefaultChannelGroup: "Channel",
  sessionSource: "Source",
  sessionMedium: "Medium",
  deviceCategory: "Device",
  browser: "Browser",
  operatingSystem: "OS",
  country: "Country",
  city: "City",
  language: "Language",
  pagePath: "Page",
  landingPage: "Landing page",
  newVsReturning: "User type",
  eventName: "Event",
};

export const metricType = (metric: string): MetricType => METRIC_TYPES[metric] ?? "integer";
export const metricLabel = (metric: string): string => METRIC_LABELS[metric] ?? metric;
export const dimensionLabel = (dimension: string): string => DIMENSION_LABELS[dimension] ?? dimension;

/** Dimensions with a natural chronological order. */
export const TEMPORAL_DIMENSIONS = new Set(["date", "hour", "dayOfWeek", "month", "yearMonth", "year"]);

/** Metrics for which a decrease is good news (e.g. bounce rate). */
export const LOWER_IS_BETTER = new Set(["bounceRate"]);

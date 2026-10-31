/** Date-range presets and helpers for the date picker. */

export interface DateRangeValue {
  /** GA date syntax: `YYYY-MM-DD`, `today`, `yesterday`, `NdaysAgo`. */
  start: string;
  end: string;
}

export interface DatePreset {
  id: string;
  label: string;
  range: DateRangeValue;
}

export const DATE_PRESETS: DatePreset[] = [
  { id: "7d", label: "Last 7 days", range: { start: "6daysAgo", end: "today" } },
  { id: "14d", label: "Last 14 days", range: { start: "13daysAgo", end: "today" } },
  { id: "28d", label: "Last 28 days", range: { start: "27daysAgo", end: "today" } },
  { id: "30d", label: "Last 30 days", range: { start: "29daysAgo", end: "today" } },
  { id: "90d", label: "Last 90 days", range: { start: "89daysAgo", end: "today" } },
];

export const DEFAULT_DATE_RANGE: DateRangeValue = DATE_PRESETS[3].range;

export function presetForRange(range: DateRangeValue): DatePreset | undefined {
  return DATE_PRESETS.find((p) => p.range.start === range.start && p.range.end === range.end);
}

export function isGaDate(value: string): boolean {
  return value === "today" || value === "yesterday" || /^\d+daysAgo$/.test(value) || isIsoDate(value);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Resolve GA date syntax to an ISO date (for display / date inputs). */
export function toIsoDate(value: string, today = new Date()): string {
  const base = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  if (value === "today") return base.toISOString().slice(0, 10);
  if (value === "yesterday") return shiftDays(base, -1);
  const m = /^(\d+)daysAgo$/.exec(value);
  if (m) return shiftDays(base, -Number(m[1]));
  return value;
}

function shiftDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Human label for a range, e.g. "Last 30 days" or "Mar 1 – Mar 15, 2025". */
export function describeRange(range: DateRangeValue, today = new Date()): string {
  const preset = presetForRange(range);
  if (preset) return preset.label;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(toIsoDate(range.start, today))} – ${fmt(toIsoDate(range.end, today))}`;
}

/** Validate a custom range. Returns an error message or null. */
export function validateRange(range: DateRangeValue, today = new Date()): string | null {
  if (!isGaDate(range.start) || !isGaDate(range.end)) return "Enter valid dates.";
  const start = toIsoDate(range.start, today);
  const end = toIsoDate(range.end, today);
  if (start > end) return "Start date must be before end date.";
  if (end > toIsoDate("today", today)) return "End date cannot be in the future.";
  return null;
}

/** Number / date formatting helpers shared across widgets. */
import type { MetricType } from "../api/types";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatInteger(value: number): string {
  return Number.isFinite(value) ? integer.format(value) : "–";
}

export function formatCompact(value: number): string {
  return Number.isFinite(value) ? compact.format(value) : "–";
}

export function formatDecimal(value: number): string {
  return Number.isFinite(value) ? decimal.format(value) : "–";
}

/** 0.6123 → "61.2%" */
export function formatPercent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "–";
}

/** 125.4 → "2m 05s"; 3725 → "1h 02m" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

/** Format according to the metric's semantic type. */
export function formatMetric(value: number, type: MetricType): string {
  switch (type) {
    case "percent":
      return formatPercent(value);
    case "seconds":
      return formatDuration(value);
    case "float":
      return formatDecimal(value);
    case "integer":
    default:
      return formatInteger(value);
  }
}

/** Signed relative change: 0.1234 → "+12.3%" */
export function formatDelta(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "–";
  const sign = ratio > 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** GA "YYYYMMDD" → "Mar 5" (or the raw value if it isn't a GA date). */
export function formatGaDate(raw: string, withYear = false): string {
  if (!/^\d{8}$/.test(raw)) return raw;
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (month < 1 || month > 12) return raw;
  const label = `${MONTHS[month - 1]} ${day}`;
  return withYear ? `${label}, ${raw.slice(0, 4)}` : label;
}

/** "YYYYMMDD" → "YYYY-MM-DD" */
export function gaDateToIso(raw: string): string {
  if (!/^\d{8}$/.test(raw)) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** "2025-03-05" → "Mar 5, 2025" */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** GA dayOfWeek "0".."6" → "Sun".."Sat" */
export function formatDayOfWeek(raw: string): string {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? DAYS[n] : raw;
}

/** GA hour "00".."23" → "12am", "1pm"… */
export function formatHour(raw: string): string {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 23) return raw;
  if (n === 0) return "12am";
  if (n === 12) return "12pm";
  return n < 12 ? `${n}am` : `${n - 12}pm`;
}

/** Best-effort label for any dimension value. */
export function formatDimensionValue(dimension: string, value: string): string {
  switch (dimension) {
    case "date":
      return formatGaDate(value);
    case "dayOfWeek":
      return formatDayOfWeek(value);
    case "hour":
      return formatHour(value);
    case "yearMonth":
      return /^\d{6}$/.test(value) ? `${MONTHS[Number(value.slice(4)) - 1]} ${value.slice(0, 4)}` : value;
    case "month":
      return /^\d{2}$/.test(value) && Number(value) >= 1 && Number(value) <= 12 ? MONTHS[Number(value) - 1] : value;
    default:
      return value;
  }
}

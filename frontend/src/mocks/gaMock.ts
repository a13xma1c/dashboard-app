/**
 * Deterministic mock Google Analytics data for the browser.
 *
 * Mirrors the backend generator (backend/app/mock_data.py) closely enough that
 * the UI behaves the same against either: per-day sessions are split across
 * dimension values with normalised shares, so breakdowns, filtered series and
 * totals are all internally consistent. Everything is seeded from the inputs,
 * so a given query always returns the same rows — ideal for tests.
 */
import type { DimensionFilter, MetadataResponse, ReportResponse, SummaryResponse } from "../api/types";

// ── Seeded randomness ─────────────────────────────────────────────────────────

/** 53-bit string hash (cyrb53). */
function hash(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 PRNG → function returning floats in [0, 1). */
function rng(...parts: unknown[]): () => number {
  let a = hash(parts.map(String).join("|")) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uniform = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

// ── Field catalogue ───────────────────────────────────────────────────────────

type Weighted = [value: string, weight: number][];

export const CATEGORICAL_DIMENSIONS: Record<string, Weighted> = {
  sessionDefaultChannelGroup: [
    ["Organic Search", 42], ["Direct", 24], ["Referral", 11], ["Organic Social", 9],
    ["Paid Search", 6], ["Email", 4], ["Display", 2], ["Unassigned", 2],
  ],
  deviceCategory: [["desktop", 55], ["mobile", 39], ["tablet", 6]],
  country: [
    ["United States", 34], ["United Kingdom", 11], ["Germany", 8], ["India", 8], ["Canada", 6],
    ["France", 5], ["Australia", 4], ["Netherlands", 3], ["Brazil", 3], ["Spain", 3], ["Japan", 2.5],
    ["Italy", 2], ["Sweden", 1.5], ["Poland", 1.5], ["Mexico", 1.2], ["Switzerland", 1], ["Ireland", 1],
    ["Singapore", 0.9], ["South Korea", 0.8], ["Belgium", 0.7],
  ],
  // Cities are children of countries — filled in from CITY_COUNTRY below.
  city: [],
  pagePath: [
    ["/", 30], ["/pricing", 9], ["/blog", 8], ["/docs", 7.5], ["/features", 6],
    ["/blog/getting-started-with-analytics", 5], ["/docs/quickstart", 4.5], ["/about", 4],
    ["/contact", 3], ["/signup", 3], ["/login", 2.8], ["/blog/10-dashboard-design-tips", 2.5],
    ["/docs/api-reference", 2.5], ["/integrations", 2], ["/customers", 1.8],
    ["/blog/measuring-engagement", 1.6], ["/docs/authentication", 1.5], ["/careers", 1.2],
    ["/changelog", 1.1], ["/security", 0.8],
  ],
  landingPage: [
    ["/", 42], ["/blog/getting-started-with-analytics", 9], ["/pricing", 8], ["/docs", 7],
    ["/blog", 6], ["/features", 5], ["/docs/quickstart", 4.5], ["/blog/10-dashboard-design-tips", 4],
    ["/signup", 3], ["/about", 2.5],
  ],
  browser: [
    ["Chrome", 58], ["Safari", 22], ["Firefox", 7], ["Edge", 7], ["Samsung Internet", 3], ["Opera", 1.5],
  ],
  operatingSystem: [
    ["Windows", 38], ["iOS", 22], ["Android", 18], ["Macintosh", 16], ["Linux", 4], ["Chrome OS", 2],
  ],
  sessionSource: [
    ["google", 46], ["(direct)", 24], ["bing", 5], ["facebook.com", 4], ["t.co", 3], ["linkedin.com", 3],
    ["newsletter", 3], ["duckduckgo", 2.5], ["github.com", 2.5], ["reddit.com", 2],
  ],
  sessionMedium: [
    ["organic", 50], ["(none)", 24], ["referral", 12], ["cpc", 6], ["email", 4], ["social", 4],
  ],
  newVsReturning: [["new", 58], ["returning", 40], ["(not set)", 2]],
  eventName: [
    ["page_view", 40], ["session_start", 15], ["user_engagement", 14], ["scroll", 12], ["first_visit", 8],
    ["click", 6], ["form_submit", 1.5], ["sign_up", 0.9], ["purchase", 0.2],
  ],
  language: [
    ["en-us", 50], ["en-gb", 14], ["de-de", 8], ["fr-fr", 5], ["es-es", 4], ["pt-br", 3], ["ja-jp", 2],
  ],
  hour: [1.2, 0.9, 0.7, 0.6, 0.6, 0.8, 1.4, 2.4, 3.8, 5.2, 6.0, 6.2, 5.8, 6.1, 6.3, 6.0, 5.4, 4.6, 3.9, 3.6, 3.4, 3.0, 2.4, 1.7]
    .map((w, h) => [String(h).padStart(2, "0"), w]),
};

// ── Hierarchy: city → country ─────────────────────────────────────────────────
// [city, country, weight within country]
export const CITY_COUNTRY: [string, string, number][] = [
  ["New York", "United States", 9], ["San Francisco", "United States", 5], ["Los Angeles", "United States", 4],
  ["Chicago", "United States", 3], ["Seattle", "United States", 2.5], ["Austin", "United States", 2],
  ["Boston", "United States", 2], ["(not set)", "United States", 4],
  ["London", "United Kingdom", 8], ["Manchester", "United Kingdom", 2], ["Edinburgh", "United Kingdom", 1],
  ["Berlin", "Germany", 4], ["Munich", "Germany", 1.8], ["Hamburg", "Germany", 1.2],
  ["Bengaluru", "India", 3], ["Mumbai", "India", 2], ["Delhi", "India", 1.8],
  ["Toronto", "Canada", 3.5], ["Vancouver", "Canada", 1.1], ["Montreal", "Canada", 1],
  ["Paris", "France", 3], ["Lyon", "France", 0.8], ["Sydney", "Australia", 2.5], ["Melbourne", "Australia", 1.2],
  ["Amsterdam", "Netherlands", 2.5], ["São Paulo", "Brazil", 1.8], ["Rio de Janeiro", "Brazil", 0.9],
  ["Madrid", "Spain", 1.6], ["Barcelona", "Spain", 1.3], ["Tokyo", "Japan", 1.5], ["Milan", "Italy", 1],
  ["Rome", "Italy", 0.9], ["Stockholm", "Sweden", 1.2], ["Warsaw", "Poland", 1.2], ["Mexico City", "Mexico", 1],
  ["Zurich", "Switzerland", 0.8], ["Dublin", "Ireland", 1.4], ["Singapore", "Singapore", 0.9],
  ["Seoul", "South Korea", 0.8], ["Brussels", "Belgium", 0.6],
];

/** child dimension → parent dimension */
export const HIERARCHY: Record<string, string> = { city: "country" };
/** child dimension → child value → parent value */
export const PARENT_OF: Record<string, Record<string, string>> = {
  city: Object.fromEntries(CITY_COUNTRY.map(([city, country]) => [city, country])),
};
/** child dimension → parent value → children with weights */
const CHILDREN_OF: Record<string, Record<string, Weighted>> = { city: {} };
for (const [city, country, w] of CITY_COUNTRY) (CHILDREN_OF.city[country] ??= []).push([city, w]);
CATEGORICAL_DIMENSIONS.city = CITY_COUNTRY.map(([city, , w]) => [city, w]);

const pad = (n: number) => String(n).padStart(2, "0");
export const gaDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

export const DERIVED_DIMENSIONS: Record<string, (d: Date) => string> = {
  date: gaDate,
  dayOfWeek: (d) => String(d.getUTCDay()),
  month: (d) => pad(d.getUTCMonth() + 1),
  year: (d) => String(d.getUTCFullYear()),
  yearMonth: (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}`,
};

const ADDITIVE = [
  "sessions", "totalUsers", "activeUsers", "newUsers", "screenPageViews", "engagedSessions",
  "eventCount", "conversions", "keyEvents", "userEngagementDuration",
] as const;
type Additive = (typeof ADDITIVE)[number];
type Totals = Record<Additive, number>;

const div = (a: number, b: number) => (b ? a / b : 0);

const DERIVED_METRICS: Record<string, (t: Totals) => number> = {
  averageSessionDuration: (t) => div(t.userEngagementDuration, t.sessions),
  engagementRate: (t) => div(t.engagedSessions, t.sessions),
  bounceRate: (t) => 1 - div(t.engagedSessions, t.sessions),
  screenPageViewsPerSession: (t) => div(t.screenPageViews, t.sessions),
  eventsPerSession: (t) => div(t.eventCount, t.sessions),
  sessionsPerUser: (t) => div(t.sessions, t.totalUsers),
};

export const METADATA: MetadataResponse = {
  dimensions: [
    ["date", "Date"], ["dayOfWeek", "Day of week"], ["month", "Month"], ["year", "Year"],
    ["yearMonth", "Year / month"], ["hour", "Hour of day"], ["sessionDefaultChannelGroup", "Channel group"],
    ["sessionSource", "Session source"], ["sessionMedium", "Session medium"], ["deviceCategory", "Device category"],
    ["browser", "Browser"], ["operatingSystem", "Operating system"], ["country", "Country"], ["city", "City"],
    ["language", "Language"], ["pagePath", "Page path"], ["landingPage", "Landing page"],
    ["newVsReturning", "New vs returning"], ["eventName", "Event name"],
  ].map(([name, label]) => ({ name, label })),
  metrics: [
    ["sessions", "Sessions", "integer"], ["totalUsers", "Total users", "integer"],
    ["activeUsers", "Active users", "integer"], ["newUsers", "New users", "integer"],
    ["screenPageViews", "Views", "integer"], ["engagedSessions", "Engaged sessions", "integer"],
    ["eventCount", "Event count", "integer"], ["conversions", "Conversions", "integer"],
    ["keyEvents", "Key events", "integer"], ["userEngagementDuration", "User engagement duration", "seconds"],
    ["averageSessionDuration", "Avg. session duration", "seconds"], ["engagementRate", "Engagement rate", "percent"],
    ["bounceRate", "Bounce rate", "percent"], ["screenPageViewsPerSession", "Views per session", "float"],
    ["eventsPerSession", "Events per session", "float"], ["sessionsPerUser", "Sessions per user", "float"],
  ].map(([name, label, type]) => ({ name, label, type: type as MetadataResponse["metrics"][number]["type"] })),
};

export const SUPPORTED_DIMENSIONS = new Set([...Object.keys(CATEGORICAL_DIMENSIONS), ...Object.keys(DERIVED_DIMENSIONS)]);
export const SUPPORTED_METRICS = new Set([...ADDITIVE, ...Object.keys(DERIVED_METRICS)]);

// ── Dates ─────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export class InvalidDateError extends Error {}

/** Resolve GA date syntax (`today`, `yesterday`, `NdaysAgo`, `YYYY-MM-DD`) to a UTC midnight Date. */
export function resolveDate(value: string, today: Date): Date {
  const v = value.trim();
  const base = utcDay(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (v === "today") return base;
  if (v === "yesterday") return new Date(base.getTime() - DAY_MS);
  const ago = /^(\d+)daysAgo$/.exec(v);
  if (ago) return new Date(base.getTime() - Number(ago[1]) * DAY_MS);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    const d = utcDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime()) && d.getUTCMonth() === Number(iso[2]) - 1) return d;
  }
  throw new InvalidDateError(`Invalid date '${value}'. Use YYYY-MM-DD, 'today', 'yesterday' or 'NdaysAgo'.`);
}

export function* eachDay(start: Date, end: Date): Generator<Date> {
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) yield new Date(t);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// ── Generator ─────────────────────────────────────────────────────────────────

const TREND_ORIGIN = Date.UTC(2024, 0, 1);

interface Profile {
  baseSessions: number; weekendFactor: number; yearlyGrowth: number; usersRatio: number;
  newRatio: number; viewsPerSession: number; engagement: number; avgDuration: number;
  eventsPerView: number; conversion: number;
}

function profile(propertyId: string): Profile {
  const r = rng("profile", propertyId);
  return {
    baseSessions: uniform(r, 600, 4000),
    weekendFactor: uniform(r, 0.6, 0.8),
    yearlyGrowth: uniform(r, -0.15, 0.35),
    usersRatio: uniform(r, 0.72, 0.9),
    newRatio: uniform(r, 0.45, 0.72),
    viewsPerSession: uniform(r, 1.7, 3.2),
    engagement: uniform(r, 0.48, 0.72),
    avgDuration: uniform(r, 55, 240),
    eventsPerView: uniform(r, 2.0, 3.8),
    conversion: uniform(r, 0.01, 0.045),
  };
}

function dailySessions(propertyId: string, p: Profile, day: Date): number {
  const r = rng("daily", propertyId, iso(day));
  const weekly = day.getUTCDay() === 0 || day.getUTCDay() === 6 ? p.weekendFactor : 1;
  const trend = 1 + (p.yearlyGrowth * (day.getTime() - TREND_ORIGIN)) / (365 * DAY_MS);
  const noise = uniform(r, 0.85, 1.15);
  const spike = r() < 0.03 ? uniform(r, 1.6, 2.6) : 1;
  return Math.max(p.baseSessions * weekly * Math.max(trend, 0.2) * noise * spike, 1);
}

function normalised(propertyId: string, dimension: string, day: Date, values: Weighted, salt = ""): Map<string, number> {
  const propR = rng("share", propertyId, dimension, salt);
  const dayR = rng("share", propertyId, dimension, salt, iso(day));
  const weighted = values.map(([value, w]) => [value, w * uniform(propR, 0.7, 1.3) * uniform(dayR, 0.9, 1.1)] as const);
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  return new Map(weighted.map(([v, w]) => [v, total ? w / total : 0]));
}

/** Share of each child value *within* `parentValue` (sums to 1). */
function conditionalShares(propertyId: string, dimension: string, day: Date, parentValue: string): Map<string, number> {
  const children = CHILDREN_OF[dimension]?.[parentValue] ?? [];
  return normalised(propertyId, dimension, day, children, parentValue);
}

/** Share of each value of `dimension` on `day`. Hierarchical dims = parent share × within-parent share. */
function shares(propertyId: string, dimension: string, day: Date): Map<string, number> {
  const parent = HIERARCHY[dimension];
  if (parent) {
    const parentShares = shares(propertyId, parent, day);
    const result = new Map<string, number>();
    for (const parentValue of Object.keys(CHILDREN_OF[dimension])) {
      for (const [child, share] of conditionalShares(propertyId, dimension, day, parentValue)) {
        result.set(child, (parentShares.get(parentValue) ?? 0) * share);
      }
    }
    return result;
  }
  return normalised(propertyId, dimension, day, CATEGORICAL_DIMENSIONS[dimension]);
}

/** Values of `dim` compatible with the active filter (hierarchy-aware). */
function valuesFor(dim: string, filter: DimensionFilter | null | undefined): string[] {
  const values = CATEGORICAL_DIMENSIONS[dim].map(([v]) => v);
  if (!filter) return values;
  if (HIERARCHY[dim] === filter.dimension) return values.filter((v) => PARENT_OF[dim][v] === filter.value);
  if (HIERARCHY[filter.dimension] === dim) {
    const parent = PARENT_OF[filter.dimension][filter.value];
    return values.includes(parent) ? [parent] : [];
  }
  if (dim === filter.dimension) return values.includes(filter.value) ? [filter.value] : [];
  return values;
}

/** Share to apply for `value` given what's already fixed by the filter / other chosen dimensions. */
function shareFor(
  propertyId: string,
  dim: string,
  value: string,
  day: Date,
  chosen: Record<string, string>,
  filter: DimensionFilter | null | undefined
): number {
  if (filter && (dim === filter.dimension || HIERARCHY[filter.dimension] === dim)) return 1;
  const parent = HIERARCHY[dim];
  if (parent) {
    const parentValue = chosen[parent] ?? (filter?.dimension === parent ? filter.value : undefined);
    if (parentValue !== undefined) return conditionalShares(propertyId, dim, day, parentValue).get(value) ?? 0;
  }
  return shares(propertyId, dim, day).get(value) ?? 0;
}

function additiveFor(propertyId: string, p: Profile, key: string[], day: Date, sessions: number): Totals {
  const r = rng("row", propertyId, key.join("\u0000"), iso(day));
  const j = () => uniform(r, 0.9, 1.1);
  const users = sessions * p.usersRatio * j();
  const views = sessions * p.viewsPerSession * j();
  const conversions = sessions * p.conversion * j();
  return {
    sessions,
    totalUsers: users,
    activeUsers: users,
    newUsers: users * p.newRatio * j(),
    screenPageViews: views,
    engagedSessions: sessions * Math.min(p.engagement * j(), 0.98),
    eventCount: views * p.eventsPerView * j(),
    conversions,
    keyEvents: conversions,
    userEngagementDuration: sessions * p.avgDuration * j(),
  };
}

function formatMetric(name: string, value: number): string {
  if ((ADDITIVE as readonly string[]).includes(name)) return String(Math.round(value));
  if (!value) return "0";
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export interface MockQuery {
  propertyId: string;
  dimensions: string[];
  metrics: string[];
  startDate?: string;
  endDate?: string;
  filter?: DimensionFilter | null;
  limit?: number;
}

export class UnsupportedFieldError extends Error {}

/** Build a GA-shaped report from the mock model. Pure & deterministic. */
export function runMockReport(query: MockQuery, today = new Date()): ReportResponse {
  const { propertyId, dimensions, metrics, filter, limit = 1000 } = query;

  const badDims = dimensions.filter((d) => !SUPPORTED_DIMENSIONS.has(d));
  if (badDims.length) throw new UnsupportedFieldError(`Unsupported dimension(s): ${badDims.join(", ")}`);
  const badMetrics = metrics.filter((m) => !SUPPORTED_METRICS.has(m));
  if (badMetrics.length) throw new UnsupportedFieldError(`Unsupported metric(s): ${badMetrics.join(", ")}`);
  if (!metrics.length) throw new UnsupportedFieldError("At least one metric is required");
  if (filter && !SUPPORTED_DIMENSIONS.has(filter.dimension)) {
    throw new UnsupportedFieldError(`Unsupported filter dimension: ${filter.dimension}`);
  }

  const start = resolveDate(query.startDate ?? "30daysAgo", today);
  const end = resolveDate(query.endDate ?? "today", today);
  if (start > end) throw new InvalidDateError(`start_date (${iso(start)}) must not be after end_date (${iso(end)})`);

  const p = profile(propertyId);
  const categorical = dimensions.filter((d) => d in CATEGORICAL_DIMENSIONS);
  const totals = new Map<string, { key: string[]; t: Totals }>();

  for (const day of eachDay(start, end)) {
    let daySessions = dailySessions(propertyId, p, day);

    if (filter) {
      if (filter.dimension in CATEGORICAL_DIMENSIONS) {
        const share = shares(propertyId, filter.dimension, day).get(filter.value) ?? 0;
        if (!share) continue;
        daySessions *= share;
      } else if (DERIVED_DIMENSIONS[filter.dimension](day) !== filter.value) {
        continue;
      }
    }

    let combos: string[][] = [[]];
    for (const d of categorical) combos = combos.flatMap((c) => valuesFor(d, filter).map((v) => [...c, v]));

    for (const combo of combos) {
      const chosen: Record<string, string> = Object.fromEntries(categorical.map((d, i) => [d, combo[i]]));
      // Skip combinations that violate the hierarchy (country=Germany, city=London).
      if (Object.entries(HIERARCHY).some(([child, parent]) => child in chosen && parent in chosen && PARENT_OF[child][chosen[child]] !== chosen[parent])) {
        continue;
      }
      let sessions = daySessions;
      for (const [d, v] of Object.entries(chosen)) sessions *= shareFor(propertyId, d, v, day, chosen, filter);
      const key = dimensions.map((d) =>
        d in DERIVED_DIMENSIONS ? DERIVED_DIMENSIONS[d](day) : combo[categorical.indexOf(d)]
      );
      const id = key.join("\u0000");
      const entry = totals.get(id) ?? {
        key,
        t: Object.fromEntries(ADDITIVE.map((m) => [m, 0])) as Totals,
      };
      const add = additiveFor(propertyId, p, key, day, sessions);
      for (const m of ADDITIVE) entry.t[m] += add[m];
      totals.set(id, entry);
    }
  }

  const rows = [...totals.values()]
    .filter(({ t }) => t.sessions >= 0.5)
    .map(({ key, t }) => [
      ...key,
      ...metrics.map((m) => formatMetric(m, m in DERIVED_METRICS ? DERIVED_METRICS[m](t) : t[m as Additive])),
    ]);

  if (dimensions.length && dimensions[0] in DERIVED_DIMENSIONS) {
    rows.sort((a, b) => a[0].localeCompare(b[0]));
  } else {
    const col = dimensions.length;
    rows.sort((a, b) => Number(b[col]) - Number(a[col]));
  }

  return { headers: [...dimensions, ...metrics], rows: rows.slice(0, limit) };
}

export const SUMMARY_METRICS = [
  "sessions", "totalUsers", "newUsers", "screenPageViews", "averageSessionDuration", "engagementRate",
];

/** Period-over-period totals, mirroring the backend `/analytics/summary` endpoint. */
export function runMockSummary(
  propertyId: string,
  startDate: string,
  endDate: string,
  filter: DimensionFilter | null | undefined,
  today = new Date()
): SummaryResponse {
  const start = resolveDate(startDate, today);
  const end = resolveDate(endDate, today);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const prevEnd = new Date(start.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY_MS);

  const totals = (s: string, e: string) => {
    const report = runMockReport(
      { propertyId, dimensions: [], metrics: SUMMARY_METRICS, startDate: s, endDate: e, filter },
      today
    );
    const row = report.rows[0] ?? SUMMARY_METRICS.map(() => "0");
    return Object.fromEntries(report.headers.map((h, i) => [h, Number(row[i])]));
  };

  return {
    metrics: SUMMARY_METRICS,
    current: totals(iso(start), iso(end)),
    previous: totals(iso(prevStart), iso(prevEnd)),
    current_range: { start_date: iso(start), end_date: iso(end) },
    previous_range: { start_date: iso(prevStart), end_date: iso(prevEnd) },
  };
}

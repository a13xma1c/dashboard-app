/** Shared colour palette. Metrics have stable colours; categories cycle. */

export const CATEGORY_COLORS = [
  "#3b82d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
  "#a855f7",
];

export const METRIC_COLORS: Record<string, string> = {
  sessions: "#3b82d4",
  totalUsers: "#10b981",
  activeUsers: "#10b981",
  newUsers: "#8b5cf6",
  screenPageViews: "#f59e0b",
  engagedSessions: "#14b8a6",
  averageSessionDuration: "#ec4899",
  engagementRate: "#06b6d4",
  bounceRate: "#ef4444",
  eventCount: "#f97316",
  conversions: "#84cc16",
};

export const categoryColor = (index: number): string => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

export const metricColor = (metric: string, index = 0): string => METRIC_COLORS[metric] ?? categoryColor(index);

/** Dimmed variant for de-emphasised slices/bars. */
export const DIMMED_OPACITY = 0.3;

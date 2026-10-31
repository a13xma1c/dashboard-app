/** Wire types shared with the FastAPI backend. */

/** Flattened GA `runReport` result. Metric values are strings, as GA returns them. */
export interface ReportResponse {
  headers: string[];
  rows: string[][];
}

export interface DateRangeOut {
  start_date: string;
  end_date: string;
}

export interface SummaryResponse {
  metrics: string[];
  current: Record<string, number>;
  previous: Record<string, number>;
  current_range: DateRangeOut;
  previous_range: DateRangeOut;
}

export type MetricType = "integer" | "float" | "percent" | "seconds";

export interface FieldMeta {
  name: string;
  label: string;
}

export interface MetricMeta extends FieldMeta {
  type: MetricType;
}

export interface MetadataResponse {
  dimensions: FieldMeta[];
  metrics: MetricMeta[];
}

export interface AuthStatus {
  authenticated: boolean;
  mock_mode: boolean;
  email: string | null;
}

/** Exact-match dimension filter, used for drill-downs. */
export interface DimensionFilter {
  dimension: string;
  value: string;
}

/** Query parameters accepted by every report endpoint. */
export interface ReportParams {
  propertyId: string;
  startDate: string;
  endDate: string;
  filter?: DimensionFilter | null;
  limit?: number;
}

export interface CustomReportParams extends ReportParams {
  dimensions: string[];
  metrics: string[];
}

export type StandardReport =
  | "overview"
  | "traffic-sources"
  | "source-medium"
  | "top-pages"
  | "landing-pages"
  | "devices"
  | "browsers"
  | "operating-systems"
  | "new-vs-returning"
  | "geo"
  | "cities"
  | "events"
  | "hourly";

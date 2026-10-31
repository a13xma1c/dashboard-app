/**
 * Data hooks. Each wraps TanStack Query and derives its key from the global
 * dashboard state, so changing the property or date range refetches every
 * widget on the page automatically.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { fetchCustomReport, fetchMetadata, fetchReport, fetchSummary } from "../api/analytics";
import type {
  DimensionFilter,
  MetadataResponse,
  ReportParams,
  ReportResponse,
  StandardReport,
  SummaryResponse,
} from "../api/types";
import { useDashboard } from "../hooks/useDashboard";

export interface ReportOptions {
  filter?: DimensionFilter | null;
  limit?: number;
  enabled?: boolean;
}

function useParams(options: ReportOptions = {}): { params: ReportParams; enabled: boolean } {
  const { propertyId, dateRange, ready } = useDashboard();
  return {
    params: {
      propertyId,
      startDate: dateRange.start,
      endDate: dateRange.end,
      filter: options.filter ?? null,
      limit: options.limit,
    },
    enabled: ready && (options.enabled ?? true),
  };
}

export function useReport(report: StandardReport, options: ReportOptions = {}): UseQueryResult<ReportResponse> {
  const { params, enabled } = useParams(options);
  return useQuery({
    queryKey: ["report", report, params],
    queryFn: () => fetchReport(report, params),
    enabled,
    // Keep the previous chart on screen while a new filter / range loads
    // instead of flashing a skeleton; WidgetCard marks the region busy.
    placeholderData: keepPreviousData,
  });
}

export function useSummary(options: ReportOptions = {}): UseQueryResult<SummaryResponse> {
  const { params, enabled } = useParams(options);
  return useQuery({
    queryKey: ["summary", params],
    queryFn: () => fetchSummary(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCustomReport(
  dimensions: string[],
  metrics: string[],
  options: ReportOptions = {}
): UseQueryResult<ReportResponse> {
  const { params, enabled } = useParams(options);
  return useQuery({
    queryKey: ["custom", params, dimensions, metrics],
    queryFn: () => fetchCustomReport({ ...params, dimensions, metrics }),
    enabled: enabled && metrics.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useMetadata(): UseQueryResult<MetadataResponse> {
  return useQuery({
    queryKey: ["metadata"],
    queryFn: fetchMetadata,
    staleTime: Infinity,
  });
}

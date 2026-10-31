import { useMemo } from "react";
import type { ReportResponse } from "../../api/types";
import { formatDimensionValue, formatMetric } from "../../lib/format";
import { TEMPORAL_DIMENSIONS, dimensionLabel, metricLabel, metricType, reportRowKey, toNumber, toObjects } from "../../lib/report";
import type { ReportRow } from "../../lib/report";
import DataTable from "./DataTable";
import type { Column, SortState } from "./DataTable";

interface Props {
  report: ReportResponse;
  /** Number of leading columns that are dimensions (rest are metrics). */
  dimensionCount: number;
  pageSize?: number;
  searchable?: boolean;
  onRowClick?: (row: ReportRow) => void;
  selectedKey?: string | null;
  /** Which metric gets a proportional bar (defaults to the first metric). */
  barMetric?: string | null;
  initialSort?: SortState;
  "aria-label"?: string;
}

/** A DataTable wired to a raw GA report: auto-typed columns & formatters. */
export default function ReportTable({
  report,
  dimensionCount,
  pageSize = 10,
  searchable = true,
  onRowClick,
  selectedKey,
  barMetric,
  initialSort,
  ...rest
}: Props) {
  const rows = useMemo(() => toObjects(report), [report]);

  const columns = useMemo<Column<ReportRow>[]>(() => {
    const dims = report.headers.slice(0, dimensionCount);
    const metrics = report.headers.slice(dimensionCount);
    const bar = barMetric === undefined ? metrics[0] : barMetric;
    return [
      ...dims.map<Column<ReportRow>>((d) => ({
        key: d,
        header: dimensionLabel(d),
        accessor: (r) => r[d],
        render: (r) => formatDimensionValue(d, r[d]),
        truncate: d === "pagePath" || d === "landingPage",
      })),
      ...metrics.map<Column<ReportRow>>((m) => ({
        key: m,
        header: metricLabel(m),
        accessor: (r) => toNumber(r[m]),
        render: (r) => formatMetric(toNumber(r[m]), metricType(m)),
        align: "right",
        bar: m === bar,
      })),
    ];
  }, [report.headers, dimensionCount, barMetric]);

  const defaultSort = useMemo<SortState | undefined>(() => {
    if (initialSort) return initialSort;
    // Time-based reports read naturally in chronological order; everything else by the first metric.
    const firstDimension = report.headers[0];
    if (dimensionCount > 0 && TEMPORAL_DIMENSIONS.has(firstDimension)) return { key: firstDimension, direction: "asc" };
    const firstMetric = report.headers[dimensionCount];
    return firstMetric ? { key: firstMetric, direction: "desc" } : undefined;
  }, [initialSort, report.headers, dimensionCount]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={reportRowKey(report.headers, dimensionCount)}
      initialSort={defaultSort}
      pageSize={pageSize}
      searchable={searchable}
      onRowClick={onRowClick}
      selectedKey={selectedKey}
      aria-label={rest["aria-label"]}
    />
  );
}

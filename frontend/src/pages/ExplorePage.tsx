import { useMemo, useState } from "react";
import { useCustomReport, useMetadata } from "../hooks/useReport";
import { useDashboard } from "../hooks/useDashboard";
import WidgetCard from "../components/ui/WidgetCard";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import BreakdownBar from "../components/charts/BreakdownBar";
import ReportTable from "../components/tables/ReportTable";
import { formatDimensionValue } from "../lib/format";
import { TEMPORAL_DIMENSIONS, metricType, toBreakdown, toSeries } from "../lib/report";
import { reportToCsv, downloadText } from "../lib/csv";
import type { ReportResponse } from "../api/types";
import controls from "../components/ui/controls.module.css";
import styles from "./pages.module.css";

const MAX_FIELDS = 5;
const MAX_LIMIT = 10_000;
const DEFAULT_LIMIT = 100;

/** Parse the row-limit input, falling back to the default and clamping to the API's bounds. */
function clampLimit(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || raw.trim() === "") return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, n));
}

interface RunConfig {
  dimensions: string[];
  metrics: string[];
  limit: number;
}

export default function ExplorePage() {
  const { propertyId } = useDashboard();
  const metadata = useMetadata();

  const [dimensions, setDimensions] = useState<string[]>(["date"]);
  const [metrics, setMetrics] = useState<string[]>(["sessions", "totalUsers"]);
  const [limitInput, setLimitInput] = useState("100");
  const limit = clampLimit(limitInput);
  const [run, setRun] = useState<RunConfig | null>({ dimensions: ["date"], metrics: ["sessions", "totalUsers"], limit: 100 });

  const result = useCustomReport(run?.dimensions ?? [], run?.metrics ?? [], { limit: run?.limit, enabled: run !== null });

  const toggle = (list: string[], set: (v: string[]) => void, value: string) => {
    if (list.includes(value)) set(list.filter((v) => v !== value));
    else if (list.length < MAX_FIELDS) set([...list, value]);
  };

  const validation = metrics.length === 0 ? "Select at least one metric." : null;
  const dirty = !run || run.dimensions.join() !== dimensions.join() || run.metrics.join() !== metrics.join() || run.limit !== limit;

  const chart = useMemo(() => pickChart(result.data, run), [result.data, run]);

  const exportCsv = () => {
    if (!result.data) return;
    const name = `ga-${propertyId}-${(run?.dimensions ?? []).join("-") || "totals"}.csv`;
    downloadText(name, reportToCsv(result.data), "text/csv");
  };

  return (
    <div className={styles.stack}>
      <WidgetCard title="Build a report" subtitle={`Pick up to ${MAX_FIELDS} dimensions and ${MAX_FIELDS} metrics.`}>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!validation) setRun({ dimensions, metrics, limit });
          }}
        >
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Dimensions ({dimensions.length}/{MAX_FIELDS})</legend>
            <div className={styles.checkList}>
              {metadata.isPending && <span className={controls.hint}>Loading fields…</span>}
              {metadata.data?.dimensions.map((d) => (
                <label key={d.name} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={dimensions.includes(d.name)}
                    onChange={() => toggle(dimensions, setDimensions, d.name)}
                    disabled={!dimensions.includes(d.name) && dimensions.length >= MAX_FIELDS}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Metrics ({metrics.length}/{MAX_FIELDS})</legend>
            <div className={styles.checkList}>
              {metadata.data?.metrics.map((m) => (
                <label key={m.name} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={metrics.includes(m.name)}
                    onChange={() => toggle(metrics, setMetrics, m.name)}
                    disabled={!metrics.includes(m.name) && metrics.length >= MAX_FIELDS}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.sideControls}>
            <label className={styles.label}>
              Row limit
              <input
                type="number"
                min={1}
                max={MAX_LIMIT}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onBlur={() => setLimitInput(String(limit))}
              />
            </label>
            {validation && (
              <span className={styles.error} role="alert">
                {validation}
              </span>
            )}
            <button type="submit" className={controls.buttonPrimary} disabled={Boolean(validation) || result.isFetching}>
              {result.isFetching ? "Running…" : dirty ? "Run report" : "Re-run"}
            </button>
            <button type="button" className={controls.button} onClick={exportCsv} disabled={!result.data}>
              Export CSV
            </button>
            {metadata.isError && (
              <span className={styles.error} role="alert">
                Could not load field list.
              </span>
            )}
          </div>
        </form>
      </WidgetCard>

      {run && (
        <>
          {chart && (
            <WidgetCard title={chart.title} query={result} height={chart.height}>
              {chart.node}
            </WidgetCard>
          )}
          <WidgetCard
            title="Results"
            subtitle={result.data ? `${result.data.rows.length} rows` : undefined}
            query={result}
          >
            {result.data && <ReportTable report={result.data} dimensionCount={run.dimensions.length} pageSize={15} aria-label="Custom report results" />}
          </WidgetCard>
        </>
      )}
    </div>
  );
}

/** Choose a chart for the result: time series for temporal dimensions, bars for one categorical dimension. */
function pickChart(data: ReportResponse | undefined, run: RunConfig | null) {
  if (!data || !run || run.dimensions.length !== 1 || data.rows.length === 0) return null;
  const [dimension] = run.dimensions;
  if (TEMPORAL_DIMENSIONS.has(dimension)) {
    return {
      title: "Chart",
      height: 280,
      node: <TimeSeriesChart data={toSeries(data)} metrics={run.metrics} xDimension={dimension} height={280} brush={dimension === "date"} />,
    };
  }
  const metric = run.metrics[0];
  const items = toBreakdown(data, dimension, metric).slice(0, 15);
  return {
    title: `Top ${items.length} by ${metric}`,
    height: undefined,
    node: <BreakdownBar items={items} metricType={metricType(metric)} labelFormatter={(n) => formatDimensionValue(dimension, n)} />,
  };
}

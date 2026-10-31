import { useMemo, useState } from "react";
import { useReport, useSummary } from "../hooks/useReport";
import { useDrilldown } from "../hooks/useDrilldown";
import { useDashboard } from "../hooks/useDashboard";
import KpiCard from "../components/ui/KpiCard";
import WidgetCard from "../components/ui/WidgetCard";
import SegmentedControl from "../components/ui/SegmentedControl";
import FilterPill from "../components/ui/FilterPill";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import type { ChartType } from "../components/charts/TimeSeriesChart";
import BreakdownPie from "../components/charts/BreakdownPie";
import { metricColor } from "../components/charts/palette";
import { LOWER_IS_BETTER, metricLabel, metricType, toBreakdown, toSeries } from "../lib/report";
import { describeRange } from "../lib/dates";
import styles from "./pages.module.css";

/** KPI metrics shown as cards; each can be toggled onto the trend chart. */
const KPI_METRICS = ["sessions", "totalUsers", "newUsers", "screenPageViews", "averageSessionDuration", "engagementRate"];

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bar", label: "Bar" },
];

export default function OverviewPage() {
  const { dateRange } = useDashboard();
  const drill = useDrilldown();
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["sessions", "totalUsers"]);
  const [chartType, setChartType] = useState<ChartType>("line");

  const summary = useSummary({ filter: drill.filter });
  const overview = useReport("overview", { filter: drill.filter });
  const channels = useReport("traffic-sources", { filter: drill.filterFor("sessionDefaultChannelGroup") });
  const devices = useReport("devices", { filter: drill.filterFor("deviceCategory") });

  const series = useMemo(() => {
    if (!overview.data) return [];
    // Engagement rate isn't a column of the daily report; derive it per day.
    return toSeries(overview.data).map((p) => ({
      ...p,
      engagementRate: Number(p.sessions) ? Number(p.engagedSessions) / Number(p.sessions) : 0,
    }));
  }, [overview.data]);

  const channelItems = useMemo(
    () => (channels.data ? toBreakdown(channels.data, "sessionDefaultChannelGroup", "sessions", { maxItems: 7 }) : []),
    [channels.data]
  );
  const deviceItems = useMemo(
    () => (devices.data ? toBreakdown(devices.data, "deviceCategory", "sessions") : []),
    [devices.data]
  );

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metric)) return prev.length > 1 ? prev.filter((m) => m !== metric) : prev;
      return [...prev, metric];
    });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.intro}>
            {describeRange(dateRange)} compared to the previous period.
          </span>
          {drill.filter && <FilterPill filter={drill.filter} onClear={drill.clear} />}
        </div>
        <span className={styles.clickHint}>Click a KPI to plot it · click a chart segment to filter</span>
      </div>

      <div className={styles.kpiGrid} role="group" aria-label="Key metrics">
        {KPI_METRICS.map((metric) => (
          <KpiCard
            key={metric}
            label={metricLabel(metric)}
            value={summary.data?.current[metric]}
            previous={summary.data?.previous[metric]}
            type={metricType(metric)}
            lowerIsBetter={LOWER_IS_BETTER.has(metric)}
            loading={summary.isPending}
            active={selectedMetrics.includes(metric)}
            onClick={() => toggleMetric(metric)}
            color={metricColor(metric)}
          />
        ))}
      </div>

      <WidgetCard
        title="Trend"
        subtitle={selectedMetrics.map(metricLabel).join(", ")}
        query={overview}
        height={320}
        actions={<SegmentedControl options={CHART_TYPES} value={chartType} onChange={setChartType} aria-label="Chart type" />}
      >
        <TimeSeriesChart data={series} metrics={selectedMetrics} chartType={chartType} height={320} brush />
      </WidgetCard>

      <div className={styles.grid2}>
        <WidgetCard title="Sessions by channel" subtitle="Click a slice to filter the page" query={channels} height={260}>
          <BreakdownPie
            items={channelItems}
            selected={drill.selectedIn("sessionDefaultChannelGroup")}
            onSelect={(name) => drill.select("sessionDefaultChannelGroup", name)}
          />
        </WidgetCard>
        <WidgetCard title="Sessions by device" subtitle="Click a slice to filter the page" query={devices} height={260}>
          <BreakdownPie
            items={deviceItems}
            selected={drill.selectedIn("deviceCategory")}
            onSelect={(name) => drill.select("deviceCategory", name)}
          />
        </WidgetCard>
      </div>
    </div>
  );
}

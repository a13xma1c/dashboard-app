import { useMemo, useState } from "react";
import { useReport } from "../hooks/useReport";
import WidgetCard from "../components/ui/WidgetCard";
import FilterPill from "../components/ui/FilterPill";
import ChipToggleGroup from "../components/ui/ChipToggleGroup";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import BreakdownBar from "../components/charts/BreakdownBar";
import { metricColor } from "../components/charts/palette";
import ReportTable from "../components/tables/ReportTable";
import { metricLabel, toBreakdown, toSeries } from "../lib/report";
import styles from "./pages.module.css";

const TREND_METRICS = ["screenPageViews", "sessions", "totalUsers"];

export default function ContentPage() {
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [trendMetrics, setTrendMetrics] = useState<string[]>(["screenPageViews"]);

  const pageFilter = selectedPage ? { dimension: "pagePath", value: selectedPage } : null;

  const pages = useReport("top-pages", { limit: 100 });
  const landing = useReport("landing-pages", { limit: 50 });
  const events = useReport("events", { filter: pageFilter });
  const trend = useReport("overview", { filter: pageFilter });

  const trendSeries = useMemo(() => (trend.data ? toSeries(trend.data) : []), [trend.data]);
  const eventItems = useMemo(() => (events.data ? toBreakdown(events.data, "eventName", "eventCount", { maxItems: 10 }) : []), [events.data]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.intro}>Which pages and events perform best.</span>
          {pageFilter && <FilterPill filter={pageFilter} onClear={() => setSelectedPage(null)} />}
        </div>
        <span className={styles.clickHint}>Click a page row to see its trend and events</span>
      </div>

      <WidgetCard
        title={selectedPage ? `Trend for ${selectedPage}` : "Trend — all pages"}
        query={trend}
        height={280}
        actions={
          <ChipToggleGroup
            options={TREND_METRICS.map((m) => ({ value: m, label: metricLabel(m), color: metricColor(m) }))}
            selected={trendMetrics}
            onChange={setTrendMetrics}
            aria-label="Trend metrics"
          />
        }
      >
        <TimeSeriesChart data={trendSeries} metrics={trendMetrics} height={280} brush />
      </WidgetCard>

      <div className={styles.grid2_1}>
        <WidgetCard title="Top pages" subtitle="Click a row to drill in" query={pages}>
          {pages.data && (
            <ReportTable
              report={pages.data}
              dimensionCount={1}
              pageSize={10}
              onRowClick={(row) => setSelectedPage((prev) => (prev === row.pagePath ? null : row.pagePath))}
              selectedKey={selectedPage}
              aria-label="Top pages table"
            />
          )}
        </WidgetCard>
        <WidgetCard title="Events" subtitle={selectedPage ? `On ${selectedPage}` : "All pages"} query={events}>
          <BreakdownBar items={eventItems} color="#f97316" />
        </WidgetCard>
      </div>

      <WidgetCard title="Landing pages" subtitle="Where sessions start" query={landing}>
        {landing.data && <ReportTable report={landing.data} dimensionCount={1} pageSize={10} aria-label="Landing pages table" />}
      </WidgetCard>
    </div>
  );
}

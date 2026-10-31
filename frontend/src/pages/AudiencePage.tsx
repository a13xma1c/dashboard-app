import { useMemo } from "react";
import { useReport } from "../hooks/useReport";
import { useDrilldown } from "../hooks/useDrilldown";
import WidgetCard from "../components/ui/WidgetCard";
import FilterPill from "../components/ui/FilterPill";
import BreakdownPie from "../components/charts/BreakdownPie";
import BreakdownBar from "../components/charts/BreakdownBar";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import { formatHour } from "../lib/format";
import { toBreakdown, toSeries } from "../lib/report";
import type { ReportResponse } from "../api/types";
import styles from "./pages.module.css";

export default function AudiencePage() {
  const drill = useDrilldown();

  const devices = useReport("devices", { filter: drill.filterFor("deviceCategory") });
  const newVsReturning = useReport("new-vs-returning", { filter: drill.filterFor("newVsReturning") });
  const browsers = useReport("browsers", { filter: drill.filterFor("browser") });
  const os = useReport("operating-systems", { filter: drill.filterFor("operatingSystem") });
  const hourly = useReport("hourly", { filter: drill.filter });
  const trend = useReport("overview", { filter: drill.filter });

  const breakdown = (report: ReportResponse | undefined, dim: string, max = Infinity) =>
    report ? toBreakdown(report, dim, "sessions", { maxItems: max }) : [];

  const deviceItems = useMemo(() => breakdown(devices.data, "deviceCategory"), [devices.data]);
  const nvrItems = useMemo(() => breakdown(newVsReturning.data, "newVsReturning"), [newVsReturning.data]);
  const browserItems = useMemo(() => breakdown(browsers.data, "browser", 8), [browsers.data]);
  const osItems = useMemo(() => breakdown(os.data, "operatingSystem", 8), [os.data]);
  const hourItems = useMemo(
    () => (hourly.data ? toBreakdown(hourly.data, "hour", "sessions").sort((a, b) => a.name.localeCompare(b.name)) : []),
    [hourly.data]
  );
  const trendSeries = useMemo(() => (trend.data ? toSeries(trend.data) : []), [trend.data]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.intro}>Who your visitors are and how they reach you.</span>
          {drill.filter && <FilterPill filter={drill.filter} onClear={drill.clear} />}
        </div>
        <span className={styles.clickHint}>Click any segment or bar to cross-filter the other widgets</span>
      </div>

      <div className={styles.grid2}>
        <WidgetCard title="Devices" query={devices} height={240}>
          <BreakdownPie
            items={deviceItems}
            height={240}
            selected={drill.selectedIn("deviceCategory")}
            onSelect={(n) => drill.select("deviceCategory", n)}
          />
        </WidgetCard>
        <WidgetCard title="New vs returning" query={newVsReturning} height={240}>
          <BreakdownPie
            items={nvrItems}
            height={240}
            selected={drill.selectedIn("newVsReturning")}
            onSelect={(n) => drill.select("newVsReturning", n)}
          />
        </WidgetCard>
      </div>

      <div className={styles.grid2}>
        <WidgetCard title="Browsers" subtitle="Sessions" query={browsers}>
          <BreakdownBar items={browserItems} selected={drill.selectedIn("browser")} onSelect={(n) => drill.select("browser", n)} />
        </WidgetCard>
        <WidgetCard title="Operating systems" subtitle="Sessions" query={os}>
          <BreakdownBar items={osItems} selected={drill.selectedIn("operatingSystem")} onSelect={(n) => drill.select("operatingSystem", n)} />
        </WidgetCard>
      </div>

      <WidgetCard title="Sessions by hour of day" subtitle="Aggregated over the selected range" query={hourly} height={220}>
        <BreakdownBar items={hourItems} layout="vertical" color="#3b82d4" labelFormatter={formatHour} />
      </WidgetCard>

      <WidgetCard title="Users over time" query={trend} height={260}>
        <TimeSeriesChart data={trendSeries} metrics={["totalUsers", "newUsers"]} chartType="area" height={260} />
      </WidgetCard>
    </div>
  );
}

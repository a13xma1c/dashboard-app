import { useMemo } from "react";
import { useCustomReport, useReport } from "../hooks/useReport";
import { useDrilldown } from "../hooks/useDrilldown";
import WidgetCard from "../components/ui/WidgetCard";
import FilterPill from "../components/ui/FilterPill";
import BreakdownPie from "../components/charts/BreakdownPie";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import { categoryColor } from "../components/charts/palette";
import ReportTable from "../components/tables/ReportTable";
import { toBreakdown, toObjects } from "../lib/report";
import type { SeriesPoint } from "../lib/report";
import styles from "./pages.module.css";

const CHANNEL = "sessionDefaultChannelGroup";
const TOP_CHANNELS = 5;

export default function AcquisitionPage() {
  const drill = useDrilldown();
  const selectedChannel = drill.selectedIn(CHANNEL);

  const channels = useReport("traffic-sources", { filter: drill.filterFor(CHANNEL) });
  const sourceMedium = useReport("source-medium", { filter: drill.filter, limit: 100 });
  const landing = useReport("landing-pages", { filter: drill.filter, limit: 50 });
  // date × channel lets us draw a stacked area of the top channels over time.
  const byDay = useCustomReport(["date", CHANNEL], ["sessions"], { filter: drill.filter });

  const channelItems = useMemo(() => (channels.data ? toBreakdown(channels.data, CHANNEL, "sessions") : []), [channels.data]);

  // Pivot rows of (date, channel, sessions) into one point per date with a key per channel.
  const { stacked, stackKeys, colors } = useMemo(() => {
    if (!byDay.data) return { stacked: [] as SeriesPoint[], stackKeys: [] as string[], colors: {} as Record<string, string> };
    const rows = toObjects(byDay.data);
    const totals = new Map<string, number>();
    rows.forEach((r) => totals.set(r[CHANNEL], (totals.get(r[CHANNEL]) ?? 0) + Number(r.sessions)));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const keep = selectedChannel ? [selectedChannel] : ranked.slice(0, TOP_CHANNELS);
    const hasOther = !selectedChannel && ranked.length > TOP_CHANNELS;

    const byDate = new Map<string, SeriesPoint>();
    rows.forEach((r) => {
      const point = byDate.get(r.date) ?? { x: r.date };
      const key = keep.includes(r[CHANNEL]) ? r[CHANNEL] : "Other";
      if (key === "Other" && !hasOther) return;
      point[key] = (Number(point[key]) || 0) + Number(r.sessions);
      byDate.set(r.date, point);
    });

    const keys = hasOther ? [...keep, "Other"] : keep;
    const palette: Record<string, string> = {};
    keys.forEach((k, i) => (palette[k] = k === "Other" ? "#b6bcc5" : categoryColor(channelItems.findIndex((c) => c.name === k) >= 0 ? channelItems.findIndex((c) => c.name === k) : i)));
    return {
      stacked: [...byDate.values()].sort((a, b) => a.x.localeCompare(b.x)).map((p) => {
        keys.forEach((k) => (p[k] = Number(p[k]) || 0));
        return p;
      }),
      stackKeys: keys,
      colors: palette,
    };
  }, [byDay.data, selectedChannel, channelItems]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.intro}>Where your traffic comes from.</span>
          {drill.filter && <FilterPill filter={drill.filter} onClear={drill.clear} />}
        </div>
        <span className={styles.clickHint}>Click a channel to focus every widget on it</span>
      </div>

      <div className={styles.grid2_1}>
        <WidgetCard
          title="Sessions by channel over time"
          subtitle={selectedChannel ? `Only ${selectedChannel}` : `Top ${TOP_CHANNELS} channels, stacked`}
          query={byDay}
          height={300}
        >
          <TimeSeriesChart
            data={stacked}
            metrics={stackKeys}
            chartType="area"
            stacked
            height={300}
            colors={colors}
            labels={Object.fromEntries(stackKeys.map((k) => [k, k]))}
          />
        </WidgetCard>
        <WidgetCard title="Channel mix" query={channels} height={300}>
          <BreakdownPie items={channelItems} height={300} selected={selectedChannel} onSelect={(n) => drill.select(CHANNEL, n)} />
        </WidgetCard>
      </div>

      <WidgetCard title="Channels" subtitle="Click a row to filter" query={channels}>
        {channels.data && (
          <ReportTable
            report={channels.data}
            dimensionCount={1}
            searchable={false}
            onRowClick={(row) => drill.select(CHANNEL, row[CHANNEL])}
            selectedKey={selectedChannel}
            aria-label="Channels table"
          />
        )}
      </WidgetCard>

      <div className={styles.grid2}>
        <WidgetCard title="Source / medium" query={sourceMedium}>
          {sourceMedium.data && <ReportTable report={sourceMedium.data} dimensionCount={2} pageSize={8} aria-label="Source / medium table" />}
        </WidgetCard>
        <WidgetCard title="Landing pages" query={landing}>
          {landing.data && <ReportTable report={landing.data} dimensionCount={1} pageSize={8} aria-label="Landing pages table" />}
        </WidgetCard>
      </div>
    </div>
  );
}

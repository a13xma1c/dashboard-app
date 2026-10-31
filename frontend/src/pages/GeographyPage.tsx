import { useMemo, useState } from "react";
import { useReport } from "../hooks/useReport";
import WidgetCard from "../components/ui/WidgetCard";
import FilterPill from "../components/ui/FilterPill";
import SegmentedControl from "../components/ui/SegmentedControl";
import BreakdownBar from "../components/charts/BreakdownBar";
import TimeSeriesChart from "../components/charts/TimeSeriesChart";
import ReportTable from "../components/tables/ReportTable";
import { metricLabel, metricType, toBreakdown, toSeries } from "../lib/report";
import styles from "./pages.module.css";

const RANK_METRICS = ["sessions", "totalUsers", "newUsers"];

export default function GeographyPage() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [rankMetric, setRankMetric] = useState("sessions");

  const countryFilter = selectedCountry ? { dimension: "country", value: selectedCountry } : null;

  const geo = useReport("geo", { limit: 100 });
  const cities = useReport("cities", { filter: countryFilter, limit: 50 });
  const trend = useReport("overview", { filter: countryFilter });

  const countryItems = useMemo(() => (geo.data ? toBreakdown(geo.data, "country", rankMetric).slice(0, 10) : []), [geo.data, rankMetric]);
  const trendSeries = useMemo(() => (trend.data ? toSeries(trend.data) : []), [trend.data]);

  const select = (name: string | null) => setSelectedCountry((prev) => (prev === name ? null : name));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.intro}>Where in the world your users are.</span>
          {countryFilter && <FilterPill filter={countryFilter} onClear={() => setSelectedCountry(null)} />}
        </div>
        <span className={styles.clickHint}>Click a country to see its cities and trend</span>
      </div>

      <div className={styles.grid2}>
        <WidgetCard
          title="Top countries"
          subtitle={`By ${metricLabel(rankMetric).toLowerCase()}`}
          query={geo}
          actions={
            <SegmentedControl
              options={RANK_METRICS.map((m) => ({ value: m, label: metricLabel(m) }))}
              value={rankMetric}
              onChange={setRankMetric}
              aria-label="Rank countries by"
            />
          }
        >
          <BreakdownBar items={countryItems} metricType={metricType(rankMetric)} selected={selectedCountry} onSelect={select} />
        </WidgetCard>

        <WidgetCard
          title={selectedCountry ? `Sessions in ${selectedCountry}` : "Sessions worldwide"}
          query={trend}
          height={Math.max(220, countryItems.length * 30 + 16)}
        >
          <TimeSeriesChart data={trendSeries} metrics={["sessions", "totalUsers"]} chartType="area" height={Math.max(220, countryItems.length * 30 + 16)} />
        </WidgetCard>
      </div>

      <div className={styles.grid2}>
        <WidgetCard title="Countries" subtitle="Click a row to drill in" query={geo}>
          {geo.data && (
            <ReportTable
              report={geo.data}
              dimensionCount={1}
              pageSize={10}
              onRowClick={(row) => select(row.country)}
              selectedKey={selectedCountry}
              aria-label="Countries table"
            />
          )}
        </WidgetCard>
        <WidgetCard title={selectedCountry ? `Cities in ${selectedCountry}` : "Top cities"} query={cities}>
          {cities.data && <ReportTable report={cities.data} dimensionCount={1} pageSize={10} aria-label="Cities table" />}
        </WidgetCard>
      </div>
    </div>
  );
}

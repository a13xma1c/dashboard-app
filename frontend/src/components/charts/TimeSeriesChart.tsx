import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatDimensionValue, formatMetric } from "../../lib/format";
import { metricLabel, metricType } from "../../lib/report";
import type { SeriesPoint } from "../../lib/report";
import { metricColor } from "./palette";

export type ChartType = "line" | "area" | "bar";

interface Props {
  data: SeriesPoint[];
  /** Metric keys to plot (each becomes a series). */
  metrics: string[];
  chartType?: ChartType;
  height?: number;
  /** Dimension the x axis represents — used for label formatting. */
  xDimension?: string;
  /** Show a brush for zooming into a sub-range. Only useful for longer series. */
  brush?: boolean;
  /** Stack series (area / bar). */
  stacked?: boolean;
  /** Override colour per metric (e.g. when series are categories, not metrics). */
  colors?: Record<string, string>;
  /** Override label per series key. */
  labels?: Record<string, string>;
}

/**
 * Multi-series chart over an ordered dimension (date, hour, …).
 * Metrics with different units (counts vs. rates vs. seconds) are placed on
 * separate y axes so toggling e.g. "Engagement rate" alongside "Sessions"
 * remains readable.
 */
export default function TimeSeriesChart({
  data,
  metrics,
  chartType = "line",
  height = 300,
  xDimension = "date",
  brush = false,
  stacked = false,
  colors,
  labels,
}: Props) {
  const axisFor = useMemo(() => {
    // Counts on the left; any rate / duration metric on the right.
    const map: Record<string, "left" | "right"> = {};
    metrics.forEach((m) => {
      const t = metricType(m);
      map[m] = t === "percent" || t === "seconds" || t === "float" ? "right" : "left";
    });
    return map;
  }, [metrics]);

  const hasRight = metrics.some((m) => axisFor[m] === "right");
  const rightType = metricType(metrics.find((m) => axisFor[m] === "right") ?? "");

  const label = (m: string) => labels?.[m] ?? metricLabel(m);
  const color = (m: string, i: number) => colors?.[m] ?? metricColor(m, i);

  const common = {
    data,
    margin: { top: 8, right: hasRight ? 8 : 16, left: 0, bottom: brush ? 0 : 4 },
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="x"
        tick={{ fontSize: 11, fill: "var(--text-muted)" }}
        tickLine={false}
        axisLine={{ stroke: "var(--border)" }}
        tickFormatter={(v: string) => formatDimensionValue(xDimension, v)}
        minTickGap={24}
      />
      <YAxis
        yAxisId="left"
        tick={{ fontSize: 11, fill: "var(--text-muted)" }}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v: number) => formatCompact(v)}
        width={48}
      />
      {hasRight && (
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatMetric(v, rightType)}
          width={56}
        />
      )}
      <Tooltip
        labelFormatter={(v) => formatDimensionValue(xDimension, String(v))}
        formatter={(value, name) => {
          const key = metrics.find((m) => label(m) === name) ?? String(name);
          return [formatMetric(Number(value), metricType(key)), String(name)];
        }}
      />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
      {brush && data.length > 10 && (
        <Brush
          dataKey="x"
          height={22}
          stroke="var(--border-strong)"
          fill="var(--bg)"
          travellerWidth={8}
          tickFormatter={(v: string) => formatDimensionValue(xDimension, v)}
        />
      )}
    </>
  );

  let chart: React.ReactElement;
  if (chartType === "bar") {
    chart = (
      <BarChart {...common} barCategoryGap="20%">
        {axes}
        {metrics.map((m, i) => (
          <Bar
            key={m}
            dataKey={m}
            name={label(m)}
            yAxisId={axisFor[m]}
            fill={color(m, i)}
            stackId={stacked ? "stack" : undefined}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    );
  } else if (chartType === "area") {
    chart = (
      <AreaChart {...common}>
        {axes}
        {metrics.map((m, i) => (
          <Area
            key={m}
            type="monotone"
            dataKey={m}
            name={label(m)}
            yAxisId={axisFor[m]}
            stroke={color(m, i)}
            fill={color(m, i)}
            fillOpacity={stacked ? 0.8 : 0.15}
            strokeWidth={2}
            stackId={stacked ? "stack" : undefined}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    );
  } else {
    chart = (
      <LineChart {...common}>
        {axes}
        {metrics.map((m, i) => (
          <Line
            key={m}
            type="monotone"
            dataKey={m}
            name={label(m)}
            yAxisId={axisFor[m]}
            stroke={color(m, i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );
}

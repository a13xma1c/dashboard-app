import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMetric } from "../../lib/format";
import type { MetricType } from "../../api/types";
import type { BreakdownItem } from "../../lib/report";
import { DIMMED_OPACITY, categoryColor } from "./palette";

interface Props {
  items: BreakdownItem[];
  metricType?: MetricType;
  /** Height per row; the chart grows with the number of items. */
  rowHeight?: number;
  minHeight?: number;
  selected?: string | null;
  onSelect?: (name: string | null) => void;
  /** Use a single colour instead of cycling the palette. */
  color?: string;
  /** Format the category label (e.g. "14" → "2pm"). */
  labelFormatter?: (name: string) => string;
  layout?: "horizontal" | "vertical";
}

/** Ranked bar chart. Horizontal (default) for categories, vertical for ordered buckets like hours. */
export default function BreakdownBar({
  items,
  metricType = "integer",
  rowHeight = 30,
  minHeight = 120,
  selected = null,
  onSelect,
  color,
  labelFormatter = (n) => n,
  layout = "horizontal",
}: Props) {
  const interactive = Boolean(onSelect);
  const height = layout === "horizontal" ? Math.max(minHeight, items.length * rowHeight + 16) : 220;

  const handleClick = (name: string) => {
    if (!onSelect) return;
    onSelect(selected === name ? null : name);
  };

  const cells = items.map((item, index) => (
    <Cell
      key={item.name}
      fill={color ?? categoryColor(index)}
      fillOpacity={selected && selected !== item.name ? DIMMED_OPACITY : 1}
      cursor={interactive ? "pointer" : undefined}
    />
  ));

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(0,0,0,0.04)" }}
      formatter={(value) => [formatMetric(Number(value), metricType), ""]}
      labelFormatter={(label) => labelFormatter(String(label))}
      separator=""
    />
  );

  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="15%">
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={labelFormatter}
            interval={0}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} />
          {tooltip}
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={(d) => handleClick(String((d as { name: string }).name))}>
            {cells}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="25%">
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 12, fill: "var(--text)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={labelFormatter}
          interval={0}
        />
        {tooltip}
        <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(d) => handleClick(String((d as { name: string }).name))}>
          {cells}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: React.ReactNode) => formatMetric(Number(v), metricType)}
            style={{ fontSize: 11, fill: "var(--text-muted)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

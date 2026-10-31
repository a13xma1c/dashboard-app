import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMetric, formatPercent } from "../../lib/format";
import type { MetricType } from "../../api/types";
import type { BreakdownItem } from "../../lib/report";
import { DIMMED_OPACITY, categoryColor } from "./palette";

interface Props {
  items: BreakdownItem[];
  metricType?: MetricType;
  height?: number;
  /** Currently selected slice (drill-down). */
  selected?: string | null;
  /** Called with the slice name, or null when the selected slice is clicked again. */
  onSelect?: (name: string | null) => void;
  donut?: boolean;
}

/** Pie / donut with clickable slices. Non-selected slices dim when a selection exists. */
export default function BreakdownPie({
  items,
  metricType = "integer",
  height = 260,
  selected = null,
  onSelect,
  donut = true,
}: Props) {
  const interactive = Boolean(onSelect);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={items}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={donut ? "48%" : 0}
          outerRadius="78%"
          paddingAngle={items.length > 1 ? 1.5 : 0}
          isAnimationActive={false}
          onClick={(entry) => {
            if (!onSelect) return;
            const name = String(entry.name);
            onSelect(selected === name ? null : name);
          }}
          style={interactive ? { cursor: "pointer" } : undefined}
          label={false}
          labelLine={false}
        >
          {items.map((item, index) => (
            <Cell
              key={item.name}
              fill={categoryColor(index)}
              fillOpacity={selected && selected !== item.name ? DIMMED_OPACITY : 1}
              stroke={selected === item.name ? "var(--text)" : "#fff"}
              strokeWidth={selected === item.name ? 2 : 1}
              aria-label={`${item.name}: ${formatMetric(item.value, metricType)}`}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, entry) => {
            const share = (entry?.payload as BreakdownItem | undefined)?.share ?? 0;
            return [`${formatMetric(Number(value), metricType)} (${formatPercent(share)})`, String(name)];
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          itemSorter={null}
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 12, maxWidth: "45%", cursor: interactive ? "pointer" : undefined }}
          formatter={(value: string) => {
            const item = items.find((i) => i.name === value);
            return (
              <span style={{ color: "var(--text)", opacity: selected && selected !== value ? 0.5 : 1 }}>
                {value} <span style={{ color: "var(--text-subtle)" }}>{item ? formatPercent(item.share, 0) : ""}</span>
              </span>
            );
          }}
          onClick={(entry) => {
            if (!onSelect) return;
            const name = String((entry as { value?: unknown }).value ?? "");
            onSelect(selected === name ? null : name);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

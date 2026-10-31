import type { UseQueryResult } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/analytics";
import type { ReportResponse } from "../api/analytics";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  query: UseQueryResult<ReportResponse>;
  dimensionKey: string;
  metricKey: string;
}

const COLORS = [
  "#3b82d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export default function PieWidget({ query }: Props) {
  if (query.isLoading) return <Placeholder text="Loading…" />;
  if (query.isError) return <Placeholder text={extractErrorMessage(query.error)} error />;
  if (!query.data) return null;

  const { rows } = query.data;

  const data = rows.map((row) => ({
    name: row[0],
    value: Number(row[1]),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString() : v)} />
        <Legend iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Placeholder({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      style={{
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: error ? "#e53e3e" : "#57606a",
        fontSize: 14,
      }}
    >
      {text}
    </div>
  );
}

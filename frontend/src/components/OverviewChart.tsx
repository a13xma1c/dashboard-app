import type { UseQueryResult } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/analytics";
import type { ReportResponse } from "../api/analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  query: UseQueryResult<ReportResponse>;
}

const COLORS = ["#3b82d4", "#10b981", "#f59e0b"];
const METRICS = ["sessions", "totalUsers", "screenPageViews"];
const LABELS: Record<string, string> = {
  sessions: "Sessions",
  totalUsers: "Users",
  screenPageViews: "Pageviews",
};

export default function OverviewChart({ query }: Props) {
  if (query.isLoading) return <Placeholder text="Loading…" />;
  if (query.isError) return <Placeholder text={extractErrorMessage(query.error)} error />;
  if (!query.data) return null;

  const { headers, rows } = query.data;

  // rows sorted by date ascending
  const data = [...rows]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((row) => {
      const point: Record<string, string | number> = { date: formatDate(row[0]) };
      headers.slice(1).forEach((h, i) => {
        point[h] = Number(row[i + 1]);
      });
      return point;
    });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend iconType="circle" iconSize={8} />
        {METRICS.filter((m) => headers.includes(m)).map((m, i) => (
          <Line
            key={m}
            type="monotone"
            dataKey={m}
            name={LABELS[m] ?? m}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatDate(raw: string): string {
  // raw format: YYYYMMDD
  if (raw.length !== 8) return raw;
  return `${raw.slice(4, 6)}/${raw.slice(6, 8)}`;
}

function Placeholder({ text, error }: { text: string; error?: boolean }) {
  return (
    <div
      style={{
        height: 280,
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

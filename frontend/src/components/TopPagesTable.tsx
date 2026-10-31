import type { UseQueryResult } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/analytics";
import type { ReportResponse } from "../api/analytics";
import styles from "./DataTable.module.css";

interface Props {
  query: UseQueryResult<ReportResponse>;
}

export default function TopPagesTable({ query }: Props) {
  if (query.isLoading) return <p className={styles.msg}>Loading…</p>;
  if (query.isError) return <p className={styles.msg} style={{ color: "#e53e3e" }}>{extractErrorMessage(query.error)}</p>;
  if (!query.data) return null;

  const { rows } = query.data;
  const sorted = [...rows].sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 20);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Page</th>
            <th className={styles.num}>Pageviews</th>
            <th className={styles.num}>Avg. Session Duration</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              <td className={styles.path}>{row[0]}</td>
              <td className={styles.num}>{Number(row[1]).toLocaleString()}</td>
              <td className={styles.num}>{formatDuration(row[2])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDuration(seconds: string): string {
  const s = Math.round(Number(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

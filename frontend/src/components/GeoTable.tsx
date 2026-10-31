import type { UseQueryResult } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/analytics";
import type { ReportResponse } from "../api/analytics";
import styles from "./DataTable.module.css";

interface Props {
  query: UseQueryResult<ReportResponse>;
}

export default function GeoTable({ query }: Props) {
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
            <th>Country</th>
            <th className={styles.num}>Sessions</th>
            <th className={styles.num}>Users</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              <td>{row[0]}</td>
              <td className={styles.num}>{Number(row[1]).toLocaleString()}</td>
              <td className={styles.num}>{Number(row[2]).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

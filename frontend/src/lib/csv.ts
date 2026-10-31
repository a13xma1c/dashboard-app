import type { ReportResponse } from "../api/types";

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialise a report as RFC 4180 CSV. */
export function reportToCsv(report: ReportResponse): string {
  const lines = [report.headers, ...report.rows].map((row) => row.map((c) => escapeCell(String(c))).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Trigger a browser download of a text blob. */
export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

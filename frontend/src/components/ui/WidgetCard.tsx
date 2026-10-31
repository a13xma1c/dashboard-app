import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { extractErrorMessage } from "../../api/analytics";
import styles from "./WidgetCard.module.css";

interface Props {
  title: string;
  subtitle?: ReactNode;
  /** Controls rendered in the card header (toggles, selects…). */
  actions?: ReactNode;
  /** When supplied, loading / error / empty states are rendered automatically. */
  query?: Pick<UseQueryResult<unknown>, "isPending" | "isError" | "error" | "refetch" | "data" | "isFetching">;
  /** Override empty detection (defaults to `data.rows.length === 0` when present). */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Fixed height for the body — keeps layouts stable while loading. */
  height?: number;
  className?: string;
  children: ReactNode;
}

function hasNoRows(data: unknown): boolean {
  return Boolean(data && typeof data === "object" && "rows" in data && Array.isArray((data as { rows: unknown[] }).rows) && (data as { rows: unknown[] }).rows.length === 0);
}

export default function WidgetCard({
  title,
  subtitle,
  actions,
  query,
  isEmpty,
  emptyMessage = "No data for this period.",
  height,
  className,
  children,
}: Props) {
  const bodyStyle = height ? { height } : undefined;

  let body: ReactNode = children;
  if (query) {
    if (query.isPending) {
      body = (
        <div className={styles.skeleton} style={bodyStyle} role="status" aria-live="polite" aria-busy="true">
          <span className="visually-hidden">Loading {title}…</span>
        </div>
      );
    } else if (query.isError) {
      body = (
        <div className={styles.state} style={bodyStyle} role="alert">
          <span className={styles.error}>{extractErrorMessage(query.error)}</span>
          <button type="button" className={styles.retry} onClick={() => void query.refetch()}>
            Retry
          </button>
        </div>
      );
    } else if (isEmpty ?? hasNoRows(query.data)) {
      body = (
        <div className={styles.state} style={bodyStyle}>
          {emptyMessage}
        </div>
      );
    }
  }

  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")} aria-label={title} aria-busy={query?.isFetching || undefined}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body} style={body === children ? bodyStyle : undefined}>
        {body}
      </div>
    </section>
  );
}

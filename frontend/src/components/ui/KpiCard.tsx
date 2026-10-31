import { formatDelta, formatMetric } from "../../lib/format";
import { relativeChange } from "../../lib/report";
import type { MetricType } from "../../api/types";
import styles from "./KpiCard.module.css";

interface Props {
  label: string;
  value?: number;
  previous?: number;
  type?: MetricType;
  /** When true, a *decrease* is shown as positive (e.g. bounce rate). */
  lowerIsBetter?: boolean;
  loading?: boolean;
  /** Makes the card a toggle button. */
  active?: boolean;
  onClick?: () => void;
  /** Accent colour used for the active indicator. */
  color?: string;
}

export default function KpiCard({
  label,
  value,
  previous,
  type = "integer",
  lowerIsBetter = false,
  loading = false,
  active,
  onClick,
  color,
}: Props) {
  const hasDelta = value !== undefined && previous !== undefined;
  const change = hasDelta ? relativeChange(value, previous) : 0;
  const improved = lowerIsBetter ? change < 0 : change > 0;
  const direction = Math.abs(change) < 0.0005 ? "flat" : improved ? "up" : "down";
  const arrow = direction === "flat" ? "→" : change > 0 ? "↑" : "↓";

  const content = (
    <>
      <span className={styles.label}>{label}</span>
      {loading || value === undefined ? (
        <span className={styles.skeleton} aria-busy="true" />
      ) : (
        <span className={styles.value}>{formatMetric(value, type)}</span>
      )}
      {hasDelta && !loading && (
        <span className={`${styles.delta} ${styles[direction]}`} title="vs. previous period">
          <span aria-hidden="true">{arrow}</span>
          {formatDelta(change)}
          <span className={styles.previous}>vs {formatMetric(previous, type)}</span>
        </span>
      )}
    </>
  );

  const className = [styles.card, active ? styles.active : ""].filter(Boolean).join(" ");
  const style = color ? ({ "--accent": color } as React.CSSProperties) : undefined;

  if (onClick) {
    return (
      <button type="button" className={className} style={style} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}

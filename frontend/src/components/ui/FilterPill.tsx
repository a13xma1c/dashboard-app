import { dimensionLabel } from "../../lib/report";
import { formatDimensionValue } from "../../lib/format";
import type { DimensionFilter } from "../../api/types";
import styles from "./controls.module.css";

interface Props {
  filter: DimensionFilter;
  onClear: () => void;
}

/** Shows the active drill-down filter with a clear button. */
export default function FilterPill({ filter, onClear }: Props) {
  return (
    <span className={styles.filterPill}>
      {dimensionLabel(filter.dimension)}: {formatDimensionValue(filter.dimension, filter.value)}
      <button type="button" className={styles.filterPillClear} onClick={onClear} aria-label="Clear filter">
        ×
      </button>
    </span>
  );
}

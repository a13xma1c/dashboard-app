import { useCallback, useMemo, useState } from "react";
import type { DimensionFilter } from "../api/types";

export interface Drilldown {
  /** The active filter, if any. */
  filter: DimensionFilter | null;
  /** Select a value (clicking the already-selected value clears it). */
  select: (dimension: string, value: string | null) => void;
  clear: () => void;
  /** The filter a widget *showing* `dimension` should apply: none for its own dimension. */
  filterFor: (dimension: string) => DimensionFilter | null;
  /** Value currently selected within `dimension`, or null. */
  selectedIn: (dimension: string) => string | null;
}

/**
 * Cross-filtering state for a page. One filter is active at a time; the widget
 * that owns the filtered dimension stays unfiltered (so the selection remains
 * visible and can be changed) while every other widget is narrowed to it.
 */
export function useDrilldown(): Drilldown {
  const [filter, setFilter] = useState<DimensionFilter | null>(null);

  const select = useCallback((dimension: string, value: string | null) => {
    setFilter((prev) => {
      if (value === null || (prev?.dimension === dimension && prev.value === value)) return null;
      return { dimension, value };
    });
  }, []);

  const clear = useCallback(() => setFilter(null), []);

  return useMemo(
    () => ({
      filter,
      select,
      clear,
      filterFor: (dimension: string) => (filter && filter.dimension !== dimension ? filter : null),
      selectedIn: (dimension: string) => (filter?.dimension === dimension ? filter.value : null),
    }),
    [filter, select, clear]
  );
}

/**
 * Global dashboard state shared by every page: which GA property is selected
 * and which date range is active. Persisted to localStorage so it survives
 * reloads and is the same on every page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_DATE_RANGE, isGaDate } from "../lib/dates";
import type { DateRangeValue } from "../lib/dates";
import { DATE_RANGE_STORAGE_KEY, PROPERTY_STORAGE_KEY } from "../lib/storage";
import { DashboardContext } from "./DashboardContext";

function readStoredRange(): DateRangeValue {
  try {
    const raw = localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (!raw) return DEFAULT_DATE_RANGE;
    const parsed = JSON.parse(raw) as Partial<DateRangeValue>;
    if (
      typeof parsed.start === "string" &&
      typeof parsed.end === "string" &&
      isGaDate(parsed.start) &&
      isGaDate(parsed.end)
    ) {
      return { start: parsed.start, end: parsed.end };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_DATE_RANGE;
}

export function DashboardProvider({
  children,
  initialPropertyId,
  initialDateRange,
}: {
  children: ReactNode;
  /** Override for tests; defaults to the stored value. */
  initialPropertyId?: string;
  initialDateRange?: DateRangeValue;
}) {
  const [propertyId, setPropertyIdState] = useState(
    () => initialPropertyId ?? localStorage.getItem(PROPERTY_STORAGE_KEY) ?? ""
  );
  const [dateRange, setDateRangeState] = useState<DateRangeValue>(() => initialDateRange ?? readStoredRange());

  // Persisting to localStorage is a genuine external-system sync, so effects are appropriate here.
  useEffect(() => {
    localStorage.setItem(PROPERTY_STORAGE_KEY, propertyId);
  }, [propertyId]);

  useEffect(() => {
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(dateRange));
  }, [dateRange]);

  const setPropertyId = useCallback((id: string) => setPropertyIdState(id.trim()), []);
  const setDateRange = useCallback((range: DateRangeValue) => setDateRangeState(range), []);

  const value = useMemo(
    () => ({ propertyId, setPropertyId, dateRange, setDateRange, ready: propertyId.length > 0 }),
    [propertyId, setPropertyId, dateRange, setDateRange]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/**
 * Global dashboard state shared by every page: which GA property is selected
 * and which date range is active.
 *
 * State is mirrored into the URL (`?property=…&start=…&end=…`) so any view is
 * a shareable deep link, and into localStorage so it survives reloads and
 * sessions. Precedence on load: explicit prop (tests) → URL → localStorage → default.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { DEFAULT_DATE_RANGE, isGaDate } from "../lib/dates";
import type { DateRangeValue } from "../lib/dates";
import { DATE_RANGE_STORAGE_KEY, PROPERTY_STORAGE_KEY, URL_PARAMS } from "../lib/storage";
import { isPagePath } from "../layouts/nav";
import { DashboardContext } from "./DashboardContext";

function readStoredRange(): DateRangeValue {
  try {
    const raw = localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (!raw) return DEFAULT_DATE_RANGE;
    const parsed = JSON.parse(raw) as Partial<DateRangeValue>;
    if (isValidRange(parsed)) return { start: parsed.start, end: parsed.end };
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_DATE_RANGE;
}

function isValidRange(value: Partial<DateRangeValue>): value is DateRangeValue {
  return (
    typeof value.start === "string" && typeof value.end === "string" && isGaDate(value.start) && isGaDate(value.end)
  );
}

function rangeFromUrl(params: URLSearchParams): DateRangeValue | null {
  const candidate = { start: params.get(URL_PARAMS.start) ?? undefined, end: params.get(URL_PARAMS.end) ?? undefined };
  return isValidRange(candidate) ? { start: candidate.start, end: candidate.end } : null;
}

export function DashboardProvider({
  children,
  initialPropertyId,
  initialDateRange,
}: {
  children: ReactNode;
  /** Override for tests; defaults to URL → stored value. */
  initialPropertyId?: string;
  initialDateRange?: DateRangeValue;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();

  const [propertyId, setPropertyIdState] = useState(
    () =>
      initialPropertyId ??
      searchParams.get(URL_PARAMS.property)?.trim() ??
      localStorage.getItem(PROPERTY_STORAGE_KEY) ??
      ""
  );
  const [dateRange, setDateRangeState] = useState<DateRangeValue>(
    () => initialDateRange ?? rangeFromUrl(searchParams) ?? readStoredRange()
  );

  // Persisting to localStorage / the URL is a genuine external-system sync, so effects are appropriate here.
  useEffect(() => {
    localStorage.setItem(PROPERTY_STORAGE_KEY, propertyId);
  }, [propertyId]);

  useEffect(() => {
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(dateRange));
  }, [dateRange]);

  // Re-run on navigation too: links between pages don't carry the query string.
  // Paths that are about to redirect (/dashboard, unknown pages) are skipped so
  // this never races the <Navigate>; the sync runs again on the final pathname.
  useEffect(() => {
    if (!isPagePath(pathname)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (propertyId) next.set(URL_PARAMS.property, propertyId);
        else next.delete(URL_PARAMS.property);
        next.set(URL_PARAMS.start, dateRange.start);
        next.set(URL_PARAMS.end, dateRange.end);
        return next;
      },
      { replace: true }
    );
  }, [propertyId, dateRange, pathname, setSearchParams]);

  const setPropertyId = useCallback((id: string) => setPropertyIdState(id.trim()), []);
  const setDateRange = useCallback((range: DateRangeValue) => setDateRangeState(range), []);

  const value = useMemo(
    () => ({ propertyId, setPropertyId, dateRange, setDateRange, ready: propertyId.length > 0 }),
    [propertyId, setPropertyId, dateRange, setDateRange]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

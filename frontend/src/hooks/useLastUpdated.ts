import { useEffect, useRef, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

const isReportQuery = (key: readonly unknown[]) => key[0] !== "auth";

/** Human label for how long ago something happened. */
export function describeAge(ms: number): string {
  if (ms < 45_000) return "just now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/**
 * Tracks when the dashboard's data was last fetched and exposes a refresh
 * action that invalidates every report query (but not the auth status).
 */
export function useLastUpdated(tickMs = 30_000) {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ predicate: (q) => isReportQuery(q.queryKey) });
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const wasFetching = useRef(false);

  // Record the moment the last in-flight request settles.
  useEffect(() => {
    if (wasFetching.current && fetching === 0) setUpdatedAt(Date.now());
    wasFetching.current = fetching > 0;
  }, [fetching]);

  // Re-render periodically so "2 min ago" stays accurate.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => isReportQuery(q.queryKey) });

  return {
    isRefreshing: fetching > 0,
    updatedAt,
    label: updatedAt === null ? null : describeAge(Math.max(0, now - updatedAt)),
    refresh,
  };
}

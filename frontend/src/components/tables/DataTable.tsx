import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface Column<T> {
  key: string;
  header: string;
  /** Raw value used for sorting & searching. */
  accessor: (row: T) => string | number;
  /** Custom cell renderer; defaults to the accessor value. */
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Included in the free-text search (defaults to true for left-aligned columns). */
  searchable?: boolean;
  /** Draw a proportional bar next to numeric values. */
  bar?: boolean;
  truncate?: boolean;
  width?: number | string;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: SortState;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  emptyMessage?: string;
  "aria-label"?: string;
}

/**
 * Generic client-side table: sortable headers, free-text search, pagination and
 * optional row selection. Everything is computed from `rows` with memoisation.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search…",
  onRowClick,
  selectedKey = null,
  emptyMessage = "No rows.",
  ...rest
}: Props<T>) {
  const [sort, setSortState] = useState<SortState | undefined>(initialSort);
  const [search, setSearchState] = useState("");
  const [page, setPage] = useState(0);

  // Jump back to the first page whenever the underlying data changes
  // (state adjustment during render — see react.dev "storing information from previous renders").
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setPage(0);
  }

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(0);
  };
  const setSort = (updater: (prev: SortState | undefined) => SortState) => {
    setSortState(updater);
    setPage(0);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    const cols = columns.filter((c) => c.searchable ?? c.align !== "right");
    return rows.filter((row) => cols.some((c) => String(c.accessor(row)).toLowerCase().includes(q)));
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);

  const maxima = useMemo(() => {
    const m: Record<string, number> = {};
    columns.filter((c) => c.bar).forEach((c) => {
      m[c.key] = Math.max(0, ...rows.map((r) => Number(c.accessor(r)) || 0));
    });
    return m;
  }, [columns, rows]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) {
        const col = columns.find((c) => c.key === key);
        return { key, direction: col?.align === "right" ? "desc" : "asc" };
      }
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  return (
    <div className={styles.wrapper}>
      {(searchable || rows.length > pageSize) && (
        <div className={styles.toolbar}>
          {searchable ? (
            <input
              type="search"
              className={styles.search}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={searchPlaceholder}
            />
          ) : (
            <span />
          )}
          <span className={styles.count}>
            {filtered.length === rows.length ? `${rows.length} rows` : `${filtered.length} of ${rows.length} rows`}
          </span>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={[styles.table, onRowClick ? styles.clickable : ""].join(" ")} aria-label={rest["aria-label"]}>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th
                    key={col.key}
                    className={[col.align === "right" ? styles.num : "", styles.sortable].join(" ")}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={ariaSort}
                    scope="col"
                  >
                    <button type="button" className={styles.sortButton} onClick={() => toggleSort(col.key)}>
                      {col.header}
                      <span className={[styles.sortIcon, active ? styles.sortIconActive : ""].join(" ")} aria-hidden="true">
                        {active ? (sort.direction === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const key = rowKey(row);
                const selected = selectedKey !== null && selectedKey === key;
                return (
                  <tr
                    key={key}
                    className={selected ? styles.selected : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-selected={onRowClick ? selected : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {columns.map((col) => {
                      const raw = col.accessor(row);
                      const content = col.render ? col.render(row) : String(raw);
                      const max = maxima[col.key];
                      return (
                        <td
                          key={col.key}
                          className={[col.align === "right" ? styles.num : "", col.truncate ? styles.truncate : ""].join(" ")}
                          title={col.truncate ? String(raw) : undefined}
                        >
                          {content}
                          {col.bar && max > 0 && (
                            <span
                              className={styles.bar}
                              style={{ width: `${Math.max(2, (Number(raw) / max) * 44)}px` }}
                              aria-hidden="true"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          <button type="button" className={styles.pageBtn} onClick={() => setPage(current - 1)} disabled={current === 0}>
            Previous
          </button>
          <span>
            Page {current + 1} of {pageCount}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

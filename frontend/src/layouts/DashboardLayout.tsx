import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import { useLastUpdated } from "../hooks/useLastUpdated";
import Badge from "../components/ui/Badge";
import DateRangePicker from "../components/ui/DateRangePicker";
import PropertySelector from "../components/ui/PropertySelector";
import { NAV_ITEMS } from "./nav";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout() {
  const { logout, mockMode, email } = useAuth();
  const { propertyId, setPropertyId, dateRange, setDateRange } = useDashboard();
  const location = useLocation();
  const { isRefreshing, label: updatedLabel, refresh } = useLastUpdated();

  const current = NAV_ITEMS.find((item) => location.pathname.includes(`/dashboard/${item.path}`)) ?? NAV_ITEMS[0];

  useEffect(() => {
    document.title = `${current.label} · GA Dashboard`;
  }, [current.label]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            GA
          </span>
          GA Dashboard
        </div>
        <nav className={styles.nav} aria-label="Dashboards">
          <span className={styles.navSection}>Reports</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              // Carry the query string so property / date range survive navigation.
              to={{ pathname: `/dashboard/${item.path}`, search: location.search }}
              className={({ isActive }) => [styles.navLink, isActive ? styles.navLinkActive : ""].join(" ")}
              title={item.description}
            >
              <NavIcon name={item.path} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          {mockMode && <Badge title="The API is serving generated demo data, not a real GA property.">Demo data</Badge>}
          {propertyId && <span>Property {propertyId}</span>}
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>{current.label}</h1>
          </div>
          <div className={styles.headerRight}>
            <PropertySelector value={propertyId} onChange={setPropertyId} compact />
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => void refresh()}
              disabled={isRefreshing}
              title={updatedLabel ? `Data updated ${updatedLabel}` : "Refresh data"}
              aria-label="Refresh data"
            >
              <RefreshIcon spinning={isRefreshing} />
              <span className={styles.updated} aria-live="polite">
                {isRefreshing ? "Refreshing…" : updatedLabel ? `Updated ${updatedLabel}` : "Refresh"}
              </span>
            </button>
            {email && <span className={styles.email}>{email}</span>}
            <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={spinning ? styles.spin : undefined}
      aria-hidden="true"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = { className: styles.navIcon, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "overview":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      );
    case "audience":
      return (
        <svg {...common}>
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        </svg>
      );
    case "acquisition":
      return (
        <svg {...common}>
          <path d="M2 12l4-4 3 3 5-6" />
          <path d="M10 5h4v4" />
        </svg>
      );
    case "content":
      return (
        <svg {...common}>
          <rect x="3" y="2" width="10" height="12" rx="1.5" />
          <path d="M5.5 6h5M5.5 9h5" />
        </svg>
      );
    case "geography":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
      );
  }
}

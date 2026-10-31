import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import Badge from "../components/ui/Badge";
import DateRangePicker from "../components/ui/DateRangePicker";
import PropertySelector from "../components/ui/PropertySelector";
import { NAV_ITEMS } from "./nav";
import styles from "./DashboardLayout.module.css";

export default function DashboardLayout() {
  const { logout, mockMode, email } = useAuth();
  const { propertyId, setPropertyId, dateRange, setDateRange, ready } = useDashboard();
  const location = useLocation();

  const current = NAV_ITEMS.find((item) => location.pathname.includes(`/dashboard/${item.path}`)) ?? NAV_ITEMS[0];

  return (
    <div className={styles.shell}>
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
              to={`/dashboard/${item.path}`}
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
            {email && <span className={styles.email}>{email}</span>}
            <button type="button" className={styles.logoutBtn} onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </header>

        {ready ? (
          <main className={styles.main}>
            <Outlet />
          </main>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyTitle}>Connect a GA4 property</span>
            <p>Enter your GA4 Property ID above to load the dashboards.</p>
            <p className={styles.hint}>
              Find it in Google Analytics → Admin → Property Settings → Property ID.
              {mockMode && " In demo mode any number works — try 123456789."}
            </p>
            <PropertySelector value={propertyId} onChange={setPropertyId} />
          </div>
        )}
      </div>
    </div>
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

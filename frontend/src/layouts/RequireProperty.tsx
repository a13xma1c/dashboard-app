import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../hooks/useDashboard";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import PropertySelector from "../components/ui/PropertySelector";
import styles from "./DashboardLayout.module.css";

/**
 * Pathless layout route: renders the dashboard pages only once a GA4 property
 * has been selected, otherwise an empty state prompting for one. Keeping this
 * separate from DashboardLayout means index/redirect routes always mount.
 */
export default function RequireProperty() {
  const { mockMode } = useAuth();
  const { propertyId, setPropertyId, ready } = useDashboard();
  const { pathname } = useLocation();

  if (ready) {
    return (
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {/* Reset the boundary on navigation; pages are lazy-loaded so a Suspense fallback is needed too. */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    );
  }

  return (
    <div className={styles.empty} id="main-content">
      <span className={styles.emptyTitle}>Connect a GA4 property</span>
      <p>Enter your GA4 Property ID above to load the dashboards.</p>
      <p className={styles.hint}>
        Find it in Google Analytics → Admin → Property Settings → Property ID.
        {mockMode && " In demo mode any number works — try 123456789."}
      </p>
      <PropertySelector value={propertyId} onChange={setPropertyId} />
    </div>
  );
}

function PageFallback() {
  return (
    <div className={styles.pageFallback} role="status" aria-live="polite">
      Loading page…
    </div>
  );
}

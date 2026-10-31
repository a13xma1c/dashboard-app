import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  fetchOverview,
  fetchTrafficSources,
  fetchTopPages,
  fetchDevices,
  fetchGeo,
} from "../api/analytics";
import OverviewChart from "../components/OverviewChart";
import PieWidget from "../components/PieWidget";
import TopPagesTable from "../components/TopPagesTable";
import GeoTable from "../components/GeoTable";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const { logout } = useAuth();
  const [propertyId, setPropertyId] = useState(
    () => localStorage.getItem("ga_property_id") ?? ""
  );
  const [inputValue, setInputValue] = useState(propertyId);

  const enabled = propertyId.trim().length > 0;

  const overview = useQuery({
    queryKey: ["overview", propertyId],
    queryFn: () => fetchOverview(propertyId),
    enabled,
  });

  const traffic = useQuery({
    queryKey: ["traffic", propertyId],
    queryFn: () => fetchTrafficSources(propertyId),
    enabled,
  });

  const pages = useQuery({
    queryKey: ["pages", propertyId],
    queryFn: () => fetchTopPages(propertyId),
    enabled,
  });

  const devices = useQuery({
    queryKey: ["devices", propertyId],
    queryFn: () => fetchDevices(propertyId),
    enabled,
  });

  const geo = useQuery({
    queryKey: ["geo", propertyId],
    queryFn: () => fetchGeo(propertyId),
    enabled,
  });

  const handleApply = () => {
    const id = inputValue.trim();
    setPropertyId(id);
    localStorage.setItem("ga_property_id", id);
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.logo}>GA Dashboard</span>
        <div className={styles.headerRight}>
          <div className={styles.propertyBar}>
            <label className={styles.propertyLabel}>GA4 Property ID</label>
            <input
              className={styles.propertyInput}
              placeholder="e.g. 123456789"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
            />
            <button className={styles.applyBtn} onClick={handleApply}>
              Apply
            </button>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {!enabled ? (
        <div className={styles.empty}>
          <p>Enter your GA4 Property ID above to load dashboards.</p>
          <p className={styles.hint}>
            Find it in Google Analytics → Admin → Property Settings.
          </p>
        </div>
      ) : (
        <main className={styles.main}>
          {/* Overview line chart */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sessions / Users / Pageviews (last 30 days)</h2>
            <OverviewChart query={overview} />
          </section>

          {/* Traffic sources + Devices */}
          <div className={styles.row}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Traffic Sources</h2>
              <PieWidget query={traffic} dimensionKey="sessionDefaultChannelGroup" metricKey="sessions" />
            </section>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Devices</h2>
              <PieWidget query={devices} dimensionKey="deviceCategory" metricKey="sessions" />
            </section>
          </div>

          {/* Top pages */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top Pages</h2>
            <TopPagesTable query={pages} />
          </section>

          {/* Geo */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sessions by Country</h2>
            <GeoTable query={geo} />
          </section>
        </main>
      )}
    </div>
  );
}

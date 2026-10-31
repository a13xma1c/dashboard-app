import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DashboardProvider } from "./context/DashboardProvider";
import DashboardLayout from "./layouts/DashboardLayout";
import RequireProperty from "./layouts/RequireProperty";
import { DEFAULT_PAGE } from "./layouts/nav";
import LoginPage from "./pages/LoginPage";

// Pages are code-split so the initial bundle only carries the shell + the page you land on.
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const AudiencePage = lazy(() => import("./pages/AudiencePage"));
const AcquisitionPage = lazy(() => import("./pages/AcquisitionPage"));
const ContentPage = lazy(() => import("./pages/ContentPage"));
const GeographyPage = lazy(() => import("./pages/GeographyPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));

export function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 15,
      }}
      role="status"
    >
      Loading…
    </div>
  );
}

export default function App() {
  const { authenticated } = useAuth();

  if (authenticated === null) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={authenticated ? <Navigate to={`/dashboard/${DEFAULT_PAGE}`} replace /> : <LoginPage />} />
      <Route
        path="/dashboard"
        element={
          authenticated ? (
            <DashboardProvider>
              <DashboardLayout />
            </DashboardProvider>
          ) : (
            <Navigate to="/" replace />
          )
        }
      >
        <Route index element={<Navigate to={`/dashboard/${DEFAULT_PAGE}`} replace />} />
        {/* Pages need a property; the redirects above/below must work without one. */}
        <Route element={<RequireProperty />}>
          <Route path="overview" element={<OverviewPage />} />
          <Route path="audience" element={<AudiencePage />} />
          <Route path="acquisition" element={<AcquisitionPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="geography" element={<GeographyPage />} />
          <Route path="explore" element={<ExplorePage />} />
        </Route>
        {/* Absolute target: a relative one would resolve under the unknown path and loop. */}
        <Route path="*" element={<Navigate to={`/dashboard/${DEFAULT_PAGE}`} replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

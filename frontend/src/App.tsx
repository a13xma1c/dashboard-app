import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { DashboardProvider } from "./context/DashboardProvider";
import DashboardLayout from "./layouts/DashboardLayout";
import { DEFAULT_PAGE } from "./layouts/nav";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import AudiencePage from "./pages/AudiencePage";
import AcquisitionPage from "./pages/AcquisitionPage";
import ContentPage from "./pages/ContentPage";
import GeographyPage from "./pages/GeographyPage";
import ExplorePage from "./pages/ExplorePage";

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
        <Route index element={<Navigate to={DEFAULT_PAGE} replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="audience" element={<AudiencePage />} />
        <Route path="acquisition" element={<AcquisitionPage />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="geography" element={<GeographyPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="*" element={<Navigate to={DEFAULT_PAGE} replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

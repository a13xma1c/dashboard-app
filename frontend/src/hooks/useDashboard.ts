import { useContext } from "react";
import { DashboardContext } from "../context/DashboardContext";
import type { DashboardContextValue } from "../context/DashboardContext";

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return ctx;
}

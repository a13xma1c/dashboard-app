import { createContext } from "react";
import type { DateRangeValue } from "../lib/dates";

export interface DashboardContextValue {
  propertyId: string;
  setPropertyId: (id: string) => void;
  dateRange: DateRangeValue;
  setDateRange: (range: DateRangeValue) => void;
  /** True once a non-empty property ID has been entered. */
  ready: boolean;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

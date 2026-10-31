import axios from "axios";
import api from "./client";

export interface ReportResponse {
  headers: string[];
  rows: string[][];
}

/** Extract a human-readable message from an Axios error. */
export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (err.response?.status === 401) return "Session expired — please sign in again.";
    if (err.response?.status === 502) return "Google Analytics API error — check your Property ID and permissions.";
  }
  return "Failed to load data.";
}

export const fetchOverview = (propertyId: string): Promise<ReportResponse> =>
  api.get(`/analytics/overview/${propertyId}`).then((r) => r.data);

export const fetchTrafficSources = (propertyId: string): Promise<ReportResponse> =>
  api.get(`/analytics/traffic-sources/${propertyId}`).then((r) => r.data);

export const fetchTopPages = (propertyId: string): Promise<ReportResponse> =>
  api.get(`/analytics/top-pages/${propertyId}`).then((r) => r.data);

export const fetchDevices = (propertyId: string): Promise<ReportResponse> =>
  api.get(`/analytics/devices/${propertyId}`).then((r) => r.data);

export const fetchGeo = (propertyId: string): Promise<ReportResponse> =>
  api.get(`/analytics/geo/${propertyId}`).then((r) => r.data);

export const checkAuth = (): Promise<{ authenticated: boolean }> =>
  api.get("/auth/me").then((r) => r.data);

export const logout = (): Promise<void> =>
  api.post("/auth/logout").then(() => undefined);

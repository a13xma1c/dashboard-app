import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { AuthContext } from "@/context/AuthContext";
import type { AuthContextValue } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardProvider";
import type { DateRangeValue } from "@/lib/dates";

export const TEST_PROPERTY_ID = "123456789";
export const TEST_DATE_RANGE: DateRangeValue = { start: "2025-03-01", end: "2025-03-14" };

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export const defaultAuth: AuthContextValue = {
  authenticated: true,
  mockMode: true,
  email: "demo@example.com",
  refetch: async () => {},
  login: async () => {},
  logout: async () => {},
};

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  /** Path pattern the element is mounted at (defaults to `route`). */
  path?: string;
  propertyId?: string;
  dateRange?: DateRangeValue;
  auth?: Partial<AuthContextValue>;
  queryClient?: QueryClient;
}

/**
 * Render with every provider a page needs: QueryClient, MemoryRouter,
 * AuthContext (static value) and DashboardProvider (property + date range).
 */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const {
    route = "/",
    path = route,
    propertyId = TEST_PROPERTY_ID,
    dateRange = TEST_DATE_RANGE,
    auth,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthContext.Provider value={{ ...defaultAuth, ...auth }}>
            <DashboardProvider initialPropertyId={propertyId} initialDateRange={dateRange}>
              <Routes>
                <Route path={path} element={children} />
                <Route path="*" element={children} />
              </Routes>
            </DashboardProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

/** Minimal GA-shaped report for unit tests. */
export function makeReport(headers: string[], rows: (string | number)[][]) {
  return { headers, rows: rows.map((r) => r.map(String)) };
}

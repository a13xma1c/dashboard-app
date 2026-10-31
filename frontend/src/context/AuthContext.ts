import { createContext } from "react";

/** TanStack Query key for the auth status. */
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export interface AuthContextValue {
  /** null = still loading */
  authenticated: boolean | null;
  /** True when the backend serves generated demo data instead of real GA. */
  mockMode: boolean;
  email: string | null;
  refetch: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  authenticated: null,
  mockMode: false,
  email: null,
  refetch: async () => {},
  login: async () => {},
  logout: async () => {},
});

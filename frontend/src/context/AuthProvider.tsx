import { useCallback, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkAuth, login as apiLogin, logout as apiLogout } from "../api/analytics";
import { UNAUTHORIZED_EVENT } from "../api/client";
import type { AuthStatus } from "../api/types";
import { AUTH_QUERY_KEY, AuthContext } from "./AuthContext";

const LOGGED_OUT: AuthStatus = { authenticated: false, mock_mode: false, email: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: checkAuth,
    retry: false,
    staleTime: Infinity,
  });

  const refetch = useCallback(async () => {
    await status.refetch();
  }, [status]);

  const login = useCallback(async () => {
    await apiLogin();
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await apiLogout();
    queryClient.setQueryData(AUTH_QUERY_KEY, (prev: AuthStatus | undefined) => ({
      ...LOGGED_OUT,
      mock_mode: prev?.mock_mode ?? false,
    }));
    // Drop cached reports so the next user doesn't see stale data.
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
  }, [queryClient]);

  // Session expired server-side (401 from a report) → mark as signed out locally.
  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, (prev: AuthStatus | undefined) => ({
        ...LOGGED_OUT,
        mock_mode: prev?.mock_mode ?? false,
      }));
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const data = status.isError ? LOGGED_OUT : status.data;

  const value = useMemo(
    () => ({
      authenticated: data ? data.authenticated : null,
      mockMode: data?.mock_mode ?? false,
      email: data?.email ?? null,
      refetch,
      login,
      logout,
    }),
    [data, refetch, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

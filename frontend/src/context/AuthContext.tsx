import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { checkAuth, logout as apiLogout } from "../api/analytics";

interface AuthContextValue {
  authenticated: boolean | null; // null = loading
  refetch: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: null,
  refetch: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const refetch = () => {
    checkAuth()
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => setAuthenticated(false));
  };

  useEffect(() => {
    refetch();
  }, []);

  const logout = async () => {
    await apiLogout();
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

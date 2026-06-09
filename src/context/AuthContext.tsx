"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchStorageMode,
  loginApi,
  logoutApi,
  registerApi,
  restoreSession,
  type AuthUser,
} from "../lib/api/apiClient";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  storageMode: "postgresql" | "local";
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<"postgresql" | "local">("local");

  const refreshUser = useCallback(async () => {
    const me = await restoreSession();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mode = await fetchStorageMode();
      if (cancelled) return;
      setStorageMode(mode);
      if (mode === "postgresql") {
        await refreshUser();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginApi(email, password);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const u = await registerApi(email, password, displayName);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, storageMode, login, register, logout, refreshUser }),
    [user, loading, storageMode, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

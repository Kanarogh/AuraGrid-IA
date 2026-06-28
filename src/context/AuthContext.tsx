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
import {
  resolveInitialStorageMode,
  type ResolvedStorageMode,
  type StorageMode,
} from "../lib/storageMode";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  storageMode: StorageMode;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthBootstrap = {
  storageMode: ResolvedStorageMode;
  user: AuthUser | null;
};

let authBootstrapCache: AuthBootstrap | null = null;

export function getCachedAuthBootstrap(): AuthBootstrap | null {
  return authBootstrapCache;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authBootstrapCache?.user ?? null);
  const [loading, setLoading] = useState(() => authBootstrapCache === null);
  const [storageMode, setStorageMode] = useState<StorageMode>(() =>
    resolveInitialStorageMode(authBootstrapCache?.storageMode)
  );

  const refreshUser = useCallback(async () => {
    const me = await restoreSession();
    setUser(me);
  }, []);

  useEffect(() => {
    if (authBootstrapCache) return;
    let cancelled = false;
    (async () => {
      const mode = await fetchStorageMode();
      if (cancelled) return;
      let me: AuthUser | null = null;
      if (mode === "postgresql") {
        me = await restoreSession();
      }
      if (cancelled) return;
      authBootstrapCache = { storageMode: mode, user: me };
      setStorageMode(mode);
      setUser(me);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginApi(email, password);
    setUser(u);
    if (authBootstrapCache) authBootstrapCache = { ...authBootstrapCache, user: u };
    return u;
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const u = await registerApi(email, password, displayName);
    setUser(u);
    if (authBootstrapCache) authBootstrapCache = { ...authBootstrapCache, user: u };
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    if (authBootstrapCache) authBootstrapCache = { ...authBootstrapCache, user: null };
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

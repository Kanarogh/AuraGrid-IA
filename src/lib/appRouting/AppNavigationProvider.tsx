"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppSection } from "../sectionMeta";
import { mergeClientRoute, buildClientPath, buildLoginPath, parseAppPath } from "./paths";
import type { ClientRoute, NavigateOptions, ParsedLocation } from "./types";

const PENDING_NAV_TIMEOUT_MS = 5000;

type BeforeNavigateFn = (next: ClientRoute) => Promise<boolean>;
type CommitNavigationFn = (
  partial: Partial<ClientRoute>,
  options?: NavigateOptions
) => Promise<boolean>;

export type PendingNavigation = {
  id: number;
  targetPath: string;
  startedAt: number;
};

type AppNavigationContextValue = {
  parsedLocation: ParsedLocation;
  clientRoute: ClientRoute | null;
  defaultClientId: string;
  pendingNavigationRef: React.MutableRefObject<PendingNavigation | null>;
  /** @deprecated Use pendingNavigationRef */
  pendingNavigationPathRef: React.MutableRefObject<string | null>;
  navigateClient: (
    partial: Partial<ClientRoute>,
    options?: NavigateOptions
  ) => Promise<boolean>;
  /** Facade: usa commitNavigation registrado pelo App quando disponível. */
  navigateRoute: (
    partial: Partial<ClientRoute>,
    options?: NavigateOptions
  ) => Promise<boolean>;
  registerCommitNavigation: (fn: CommitNavigationFn | null) => void;
  navigateSection: (section: AppSection, options?: NavigateOptions) => Promise<boolean>;
  replaceClientRoute: (route: ClientRoute) => void;
  setBeforeNavigate: (fn: BeforeNavigateFn | null) => void;
  isApplyingRouteRef: React.MutableRefObject<boolean>;
  isNavigationInFlight: () => boolean;
};

const AppNavigationContext = createContext<AppNavigationContextValue | null>(null);

export function AppNavigationProvider({
  children,
  defaultClientId = "",
}: {
  children: ReactNode;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const beforeNavigateRef = useRef<BeforeNavigateFn | null>(null);
  const commitNavigationRef = useRef<CommitNavigationFn | null>(null);
  const isApplyingRouteRef = useRef(false);
  const navigationIdRef = useRef(0);
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const pendingNavigationPathRef = useRef<string | null>(null);
  const currentRouteRef = useRef<ClientRoute | null>(null);
  const defaultClientIdRef = useRef(defaultClientId);
  defaultClientIdRef.current = defaultClientId;

  const parsedLocation = useMemo(
    () => parseAppPath(pathname, searchParams),
    [pathname, searchParams]
  );

  const clientRoute = parsedLocation.kind === "client" ? parsedLocation.route : null;
  currentRouteRef.current = clientRoute;

  const setPendingNavigation = useCallback((path: string) => {
    const pending: PendingNavigation = {
      id: ++navigationIdRef.current,
      targetPath: path,
      startedAt: Date.now(),
    };
    pendingNavigationRef.current = pending;
    pendingNavigationPathRef.current = path;
  }, []);

  const clearPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
    pendingNavigationPathRef.current = null;
  }, []);

  const isNavigationInFlight = useCallback(() => {
    const pending = pendingNavigationRef.current;
    if (pending) {
      if (Date.now() - pending.startedAt > PENDING_NAV_TIMEOUT_MS) {
        clearPendingNavigation();
        return false;
      }
      return true;
    }
    return isApplyingRouteRef.current;
  }, [clearPendingNavigation]);

  const pushPath = useCallback(
    (path: string, replace?: boolean) => {
      setPendingNavigation(path);
      isApplyingRouteRef.current = true;
      if (replace) router.replace(path);
      else router.push(path);
      queueMicrotask(() => {
        isApplyingRouteRef.current = false;
      });
    },
    [router, setPendingNavigation]
  );

  const navigateClient = useCallback(
    async (partial: Partial<ClientRoute>, options?: NavigateOptions): Promise<boolean> => {
      const resolvedClientId =
        partial.clientId ?? currentRouteRef.current?.clientId ?? defaultClientIdRef.current;

      if (!resolvedClientId) return false;

      const base =
        currentRouteRef.current ??
        ({
          clientId: resolvedClientId,
          section: partial.section ?? "posts",
        } as ClientRoute);

      const next = mergeClientRoute(
        { ...base, clientId: resolvedClientId },
        { ...partial, clientId: resolvedClientId }
      );

      if (!options?.skipDirtyGuard && beforeNavigateRef.current) {
        const ok = await beforeNavigateRef.current(next);
        if (!ok) return false;
      }

      const path = buildClientPath(next);
      const currentPath = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (path === currentPath) {
        return true;
      }

      pushPath(path, options?.replace);
      return true;
    },
    [pathname, pushPath, searchParams]
  );

  const navigateRoute = useCallback(
    async (partial: Partial<ClientRoute>, options?: NavigateOptions) => {
      if (commitNavigationRef.current) {
        return commitNavigationRef.current(partial, options);
      }
      return navigateClient(partial, options);
    },
    [navigateClient]
  );

  const registerCommitNavigation = useCallback((fn: CommitNavigationFn | null) => {
    commitNavigationRef.current = fn;
  }, []);

  const navigateSection = useCallback(
    (section: AppSection, options?: NavigateOptions) => navigateRoute({ section }, options),
    [navigateRoute]
  );

  const replaceClientRoute = useCallback(
    (route: ClientRoute) => {
      const path = buildClientPath(route);
      setPendingNavigation(path);
      isApplyingRouteRef.current = true;
      router.replace(path);
      queueMicrotask(() => {
        isApplyingRouteRef.current = false;
      });
    },
    [router, setPendingNavigation]
  );

  const setBeforeNavigate = useCallback((fn: BeforeNavigateFn | null) => {
    beforeNavigateRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      parsedLocation,
      clientRoute,
      defaultClientId,
      pendingNavigationRef,
      pendingNavigationPathRef,
      navigateClient,
      navigateRoute,
      registerCommitNavigation,
      navigateSection,
      replaceClientRoute,
      setBeforeNavigate,
      isApplyingRouteRef,
      isNavigationInFlight,
    }),
    [
      parsedLocation,
      clientRoute,
      defaultClientId,
      navigateClient,
      navigateRoute,
      registerCommitNavigation,
      navigateSection,
      replaceClientRoute,
      setBeforeNavigate,
      isNavigationInFlight,
    ]
  );

  return (
    <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>
  );
}

export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error("useAppNavigation deve ser usado dentro de AppNavigationProvider");
  }
  return ctx;
}

/** Redireciona para login preservando returnTo. */
export function redirectToLogin(router: ReturnType<typeof useRouter>, returnTo: string) {
  router.replace(buildLoginPath(returnTo));
}

export function resolvePendingNavigation(
  pending: PendingNavigation | null,
  routePath: string,
  now = Date.now()
): "match" | "blocked" | "expired" {
  if (!pending) return "expired";
  if (now - pending.startedAt > PENDING_NAV_TIMEOUT_MS) return "expired";
  if (routePath === pending.targetPath) return "match";
  return "blocked";
}

export { PENDING_NAV_TIMEOUT_MS };

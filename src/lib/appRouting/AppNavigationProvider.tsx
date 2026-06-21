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

type BeforeNavigateFn = (next: ClientRoute) => Promise<boolean>;

type AppNavigationContextValue = {
  parsedLocation: ParsedLocation;
  clientRoute: ClientRoute | null;
  defaultClientId: string;
  /** Navega preservando clientId atual quando omitido. */
  navigateClient: (
    partial: Partial<ClientRoute>,
    options?: NavigateOptions
  ) => Promise<boolean>;
  navigateSection: (section: AppSection, options?: NavigateOptions) => Promise<boolean>;
  replaceClientRoute: (route: ClientRoute) => void;
  setBeforeNavigate: (fn: BeforeNavigateFn | null) => void;
  isApplyingRouteRef: React.MutableRefObject<boolean>;
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
  const isApplyingRouteRef = useRef(false);
  const currentRouteRef = useRef<ClientRoute | null>(null);
  const defaultClientIdRef = useRef(defaultClientId);
  defaultClientIdRef.current = defaultClientId;

  const parsedLocation = useMemo(
    () => parseAppPath(pathname, searchParams),
    [pathname, searchParams]
  );

  const clientRoute = parsedLocation.kind === "client" ? parsedLocation.route : null;
  currentRouteRef.current = clientRoute;

  const pushPath = useCallback(
    (path: string, replace?: boolean) => {
      if (replace) router.replace(path);
      else router.push(path);
    },
    [router]
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

      isApplyingRouteRef.current = true;
      pushPath(path, options?.replace);
      queueMicrotask(() => {
        isApplyingRouteRef.current = false;
      });
      return true;
    },
    [pathname, pushPath, searchParams]
  );

  const navigateSection = useCallback(
    (section: AppSection, options?: NavigateOptions) => navigateClient({ section }, options),
    [navigateClient]
  );

  const replaceClientRoute = useCallback(
    (route: ClientRoute) => {
      const path = buildClientPath(route);
      isApplyingRouteRef.current = true;
      router.replace(path);
      queueMicrotask(() => {
        isApplyingRouteRef.current = false;
      });
    },
    [router]
  );

  const setBeforeNavigate = useCallback((fn: BeforeNavigateFn | null) => {
    beforeNavigateRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      parsedLocation,
      clientRoute,
      defaultClientId,
      navigateClient,
      navigateSection,
      replaceClientRoute,
      setBeforeNavigate,
      isApplyingRouteRef,
    }),
    [
      parsedLocation,
      clientRoute,
      defaultClientId,
      navigateClient,
      navigateSection,
      replaceClientRoute,
      setBeforeNavigate,
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

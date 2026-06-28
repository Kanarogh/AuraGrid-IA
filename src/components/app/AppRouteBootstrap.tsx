"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import {
  buildClientPath,
  buildDashboardPath,
  buildLoginPath,
  resolveLegacyAccountSettingsRedirect,
  useAppNavigation,
} from "../../lib/appRouting";
import { isProtectedPath } from "../../lib/auth/protectedPaths";
import { isStorageModeResolved } from "../../lib/storageMode";

/** Redirects globais: home, auth e correção de rotas inválidas. */
export function AppRouteBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, storageMode } = useAuth();
  const {
    hasActiveClient,
    effectiveActiveClientId,
    clients,
    workspaceHydrated,
    useApiStorage,
  } = useClientWorkspace();
  const { parsedLocation, isNavigationInFlight } = useAppNavigation();
  const lastRedirectRef = useRef<string | null>(null);

  const clientIds = clients.map((c) => c.id);
  const dashboardPath = buildDashboardPath();

  useEffect(() => {
    if (loading || !isStorageModeResolved(storageMode)) return;
    if (useApiStorage && !workspaceHydrated) return;
    if (isNavigationInFlight()) return;

    const redirect = (path: string) => {
      if (pathname === path || lastRedirectRef.current === path) return;
      lastRedirectRef.current = path;
      router.replace(path);
    };

    const legacyAccountPath = resolveLegacyAccountSettingsRedirect(pathname);
    if (legacyAccountPath) {
      redirect(legacyAccountPath);
      return;
    }

    if (storageMode === "local" && pathname === "/login") {
      redirect("/");
      return;
    }

    if (storageMode === "postgresql" && !user) {
      if (isProtectedPath(pathname)) {
        redirect(buildLoginPath(pathname));
      }
      return;
    }

    lastRedirectRef.current = null;

    if (parsedLocation.kind === "home") {
      redirect(hasActiveClient ? dashboardPath : "/welcome");
      return;
    }

    if (parsedLocation.kind === "welcome") {
      if (hasActiveClient) {
        redirect(dashboardPath);
      }
      return;
    }

    if (parsedLocation.kind === "dashboard") {
      if (!hasActiveClient) {
        redirect("/welcome");
      }
      return;
    }

    if (parsedLocation.kind === "account") {
      return;
    }

    if (parsedLocation.kind === "login") return;

    if (parsedLocation.kind === "unknown") {
      redirect(hasActiveClient ? dashboardPath : "/welcome");
      return;
    }

    if (storageMode === "postgresql" && user?.mustChangePassword) {
      if (pathname !== "/redefinir-senha") {
        redirect("/redefinir-senha");
        return;
      }
    }

    if (parsedLocation.kind === "client") {
      const route = parsedLocation.route;
      if (!route.clientId?.trim()) return;

      if (!clientIds.includes(route.clientId)) {
        redirect("/sem-acesso");
        return;
      }
    }
  }, [
    loading,
    pathname,
    parsedLocation,
    router,
    storageMode,
    user,
    hasActiveClient,
    effectiveActiveClientId,
    clientIds,
    workspaceHydrated,
    useApiStorage,
    isNavigationInFlight,
    dashboardPath,
  ]);

  return null;
}

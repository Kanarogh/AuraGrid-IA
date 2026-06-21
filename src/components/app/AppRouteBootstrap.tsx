"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import {
  buildClientPath,
  buildLoginPath,
  resolveHomePath,
  useAppNavigation,
} from "../../lib/appRouting";
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

  useEffect(() => {
    if (loading || !isStorageModeResolved(storageMode)) return;
    if (useApiStorage && !workspaceHydrated) return;
    if (isNavigationInFlight()) return;

    const redirect = (path: string) => {
      if (pathname === path || lastRedirectRef.current === path) return;
      lastRedirectRef.current = path;
      router.replace(path);
    };

    if (storageMode === "local" && pathname === "/login") {
      redirect("/");
      return;
    }

    if (storageMode === "postgresql" && !user) {
      if (pathname.startsWith("/c/") || pathname === "/welcome") {
        redirect(buildLoginPath(pathname));
      } else if (pathname === "/") {
        redirect(buildLoginPath("/"));
      }
      return;
    }

    lastRedirectRef.current = null;

    if (parsedLocation.kind === "home") {
      if (!hasActiveClient) {
        redirect("/welcome");
        return;
      }
      redirect(resolveHomePath(clientIds, effectiveActiveClientId));
      return;
    }

    if (parsedLocation.kind === "welcome") {
      return;
    }

    if (parsedLocation.kind === "login") return;

    if (parsedLocation.kind === "unknown") {
      if (hasActiveClient && effectiveActiveClientId) {
        redirect(resolveHomePath(clientIds, effectiveActiveClientId));
      } else {
        redirect("/welcome");
      }
      return;
    }

    if (parsedLocation.kind === "client") {
      const route = parsedLocation.route;
      if (!route.clientId?.trim()) return;

      if (!clientIds.includes(route.clientId) && effectiveActiveClientId) {
        redirect(
          buildClientPath({
            ...route,
            clientId: effectiveActiveClientId,
          })
        );
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
  ]);

  return null;
}

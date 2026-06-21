"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import {
  buildLoginPath,
  resolveHomePath,
  useAppNavigation,
} from "../../lib/appRouting";

/** Redirects globais: home, auth, welcome e rotas inválidas. */
export function AppRouteBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, storageMode } = useAuth();
  const { registry, hasActiveClient, activeClientId, workspaceHydrated, useApiStorage, workspace } =
    useClientWorkspace();
  const { parsedLocation } = useAppNavigation();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (useApiStorage && !workspaceHydrated) return;

    const clientIds = registry.clients.map((c) => c.id);

    if (storageMode === "local" && pathname === "/login") {
      router.replace("/");
      return;
    }

    if (storageMode === "postgresql" && !user) {
      if (pathname.startsWith("/c/") || pathname === "/welcome") {
        router.replace(buildLoginPath(pathname));
      } else if (pathname === "/") {
        router.replace(buildLoginPath("/"));
      }
      return;
    }

    if (parsedLocation.kind === "home") {
      if (!hasActiveClient || clientIds.length === 0) {
        router.replace("/welcome");
        return;
      }
      router.replace(
        resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection)
      );
      return;
    }

    if (parsedLocation.kind === "welcome") {
      if (hasActiveClient && clientIds.length > 0) {
        router.replace(
        resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection)
      );
      }
      return;
    }

    if (parsedLocation.kind === "login") return;

    if (parsedLocation.kind === "unknown") {
      if (hasActiveClient && activeClientId) {
        router.replace(
        resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection)
      );
      } else {
        router.replace("/welcome");
      }
      return;
    }

    if (parsedLocation.kind === "client") {
      if (!hasActiveClient || clientIds.length === 0) {
        router.replace("/welcome");
      }
      bootstrappedRef.current = true;
    }
  }, [
    loading,
    pathname,
    parsedLocation,
    router,
    storageMode,
    user,
    hasActiveClient,
    activeClientId,
    registry.clients,
    workspaceHydrated,
    useApiStorage,
    workspace.ui?.activeSection,
  ]);

  return null;
}

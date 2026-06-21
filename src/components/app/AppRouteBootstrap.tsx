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
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    // Nuvem: aguardar registry da API antes de qualquer redirect baseado em clientes.
    // Evita loop /welcome ↔ /c/... com registry local vazio no primeiro paint.
    if (useApiStorage && !workspaceHydrated) return;

    const clientIds = registry.clients.map((c) => c.id);

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
      if (!hasActiveClient || clientIds.length === 0) {
        redirect("/welcome");
        return;
      }
      redirect(resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection));
      return;
    }

    if (parsedLocation.kind === "welcome") {
      if (hasActiveClient && clientIds.length > 0) {
        redirect(resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection));
      }
      return;
    }

    if (parsedLocation.kind === "login") return;

    if (parsedLocation.kind === "unknown") {
      if (hasActiveClient && activeClientId) {
        redirect(resolveHomePath(clientIds, activeClientId, workspace.ui?.activeSection));
      } else {
        redirect("/welcome");
      }
      return;
    }

    if (parsedLocation.kind === "client") {
      if (!hasActiveClient || clientIds.length === 0) {
        redirect("/welcome");
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
    activeClientId,
    registry.clients,
    workspaceHydrated,
    useApiStorage,
    workspace.ui?.activeSection,
  ]);

  return null;
}

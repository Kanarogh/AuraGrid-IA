"use client";

import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { usePathname } from "next/navigation";
import { isStorageModeResolved } from "../../lib/storageMode";
import { AppBootstrapSplash } from "./AppBootstrapSplash";

import { WorkspaceLoadErrorPanel } from "./WorkspaceLoadErrorPanel";

/**
 * Gate único de bootstrap: health → auth → workspace.
 * Redirects de rotas protegidas ficam em AppRouteBootstrap.
 */
export function AppBootstrapGate({ children }: { children: React.ReactNode }) {
  const { user, loading, storageMode } = useAuth();
  const { useApiStorage, workspaceHydrated, workspaceLoadError, retryWorkspaceLoad } =
    useClientWorkspace();
  const pathname = usePathname();

  if (loading || !isStorageModeResolved(storageMode)) {
    return <AppBootstrapSplash status="connecting" />;
  }

  if (storageMode === "postgresql" && !user) {
    if (pathname === "/login") return null;
    return <AppBootstrapSplash status="redirecting" />;
  }

  if (useApiStorage && workspaceLoadError) {
    return (
      <WorkspaceLoadErrorPanel message={workspaceLoadError} onRetry={retryWorkspaceLoad} />
    );
  }

  if (useApiStorage && !workspaceHydrated) {
    return <AppBootstrapSplash status="workspace" />;
  }

  return <>{children}</>;
}

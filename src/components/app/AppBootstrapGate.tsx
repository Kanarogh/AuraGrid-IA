"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { buildLoginPath } from "../../lib/appRouting";
import { isProtectedPath } from "../../lib/auth/protectedPaths";
import { isStorageModeResolved } from "../../lib/storageMode";
import { AppBootstrapSplash } from "./AppBootstrapSplash";

import { WorkspaceLoadErrorPanel } from "./WorkspaceLoadErrorPanel";

/**
 * Gate único de bootstrap: health → auth → workspace.
 * Redirects de rotas protegidas ficam em AppRouteBootstrap (e auth redirect aqui).
 */
export function AppBootstrapGate({ children }: { children: React.ReactNode }) {
  const { user, loading, storageMode } = useAuth();
  const { useApiStorage, workspaceHydrated, workspaceLoadError, retryWorkspaceLoad } =
    useClientWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !isStorageModeResolved(storageMode)) return;
    if (storageMode === "postgresql" && !user && isProtectedPath(pathname)) {
      router.replace(buildLoginPath(pathname));
    }
  }, [loading, storageMode, user, pathname, router]);

  if (loading || !isStorageModeResolved(storageMode)) {
    return <AppBootstrapSplash status="connecting" />;
  }

  if (storageMode === "postgresql" && !user && isProtectedPath(pathname)) {
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

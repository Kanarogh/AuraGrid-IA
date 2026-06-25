"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { buildLoginPath } from "../../lib/appRouting";
import { isStorageModeResolved } from "../../lib/storageMode";
import { AppBootstrapSplash } from "./AppBootstrapSplash";

import { WorkspaceLoadErrorPanel } from "./WorkspaceLoadErrorPanel";

/**
 * Gate único de bootstrap: health → auth → workspace.
 * Substitui spinners empilhados em AuthGate + App.
 */
export function AppBootstrapGate({ children }: { children: React.ReactNode }) {
  const { user, loading, storageMode } = useAuth();
  const { useApiStorage, workspaceHydrated, workspaceLoadError, retryWorkspaceLoad } =
    useClientWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isStorageModeResolved(storageMode)) return;
    if (storageMode === "local") return;
    if (loading) return;
    if (!user && pathname !== "/login") {
      if (pathname.startsWith("/c/") || pathname === "/" || pathname === "/welcome") {
        router.replace(buildLoginPath(pathname));
      }
    }
  }, [user, loading, storageMode, pathname, router]);

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

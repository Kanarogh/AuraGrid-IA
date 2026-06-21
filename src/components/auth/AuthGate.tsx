"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { buildLoginPath } from "../../lib/appRouting";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, storageMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (storageMode === "local") return;
    if (loading) return;
    if (!user && pathname !== "/login") {
      if (pathname.startsWith("/c/") || pathname === "/" || pathname === "/welcome") {
        router.replace(buildLoginPath(pathname));
      }
    }
  }, [user, loading, storageMode, pathname, router]);

  if (storageMode === "local") return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
        Carregando…
      </div>
    );
  }
  if (user) return <>{children}</>;

  if (pathname === "/login") return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
      Redirecionando para login…
    </div>
  );
}

"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "../../src/context/AuthContext";
import { LoginForm } from "../../src/components/auth/LoginForm";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, storageMode } = useAuth();
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    if (storageMode === "local") {
      router.replace("/");
      return;
    }
    if (!loading && user) {
      router.replace(returnTo.startsWith("/") ? returnTo : "/");
    }
  }, [user, loading, storageMode, router, returnTo]);

  if (storageMode === "local" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
        Carregando…
      </div>
    );
  }

  if (user) return null;

  return (
    <LoginForm
      onSuccess={() => {
        router.replace(returnTo.startsWith("/") ? returnTo : "/");
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
            Carregando…
          </div>
        }
      >
        <LoginPageInner />
      </Suspense>
    </AuthProvider>
  );
}

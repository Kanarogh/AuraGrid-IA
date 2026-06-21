"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, useAuth } from "../../src/context/AuthContext";
import { LoginForm } from "../../src/components/auth/LoginForm";
import { AppBootstrapSplash } from "../../src/components/app/AppBootstrapSplash";
import { isStorageModeResolved } from "../../src/lib/storageMode";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, storageMode } = useAuth();
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    if (!isStorageModeResolved(storageMode)) return;
    if (storageMode === "local") {
      router.replace("/");
      return;
    }
    if (!loading && user) {
      router.replace(returnTo.startsWith("/") ? returnTo : "/");
    }
  }, [user, loading, storageMode, router, returnTo]);

  if (!isStorageModeResolved(storageMode) || loading) {
    return <AppBootstrapSplash status="connecting" />;
  }

  if (storageMode === "local") {
    return <AppBootstrapSplash status="redirecting" />;
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
      <Suspense fallback={<AppBootstrapSplash status="connecting" />}>
        <LoginPageInner />
      </Suspense>
    </AuthProvider>
  );
}

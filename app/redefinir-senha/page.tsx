"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../src/context/AuthContext";
import { ChangePasswordForm } from "../../src/components/auth/ChangePasswordForm";
import { AppBootstrapSplash } from "../../src/components/app/AppBootstrapSplash";
import { isStorageModeResolved } from "../../src/lib/storageMode";

function RedefinirSenhaPageInner() {
  const router = useRouter();
  const { user, loading, storageMode } = useAuth();

  useEffect(() => {
    if (!isStorageModeResolved(storageMode)) return;
    if (storageMode === "local") {
      router.replace("/");
      return;
    }
    if (!loading && !user) {
      router.replace("/login?returnTo=/redefinir-senha");
      return;
    }
    if (!loading && user && !user.mustChangePassword) {
      router.replace("/dashboard");
    }
  }, [user, loading, storageMode, router]);

  if (!isStorageModeResolved(storageMode) || loading) {
    return <AppBootstrapSplash status="connecting" />;
  }

  if (storageMode === "local" || !user) {
    return <AppBootstrapSplash status="redirecting" />;
  }

  if (!user.mustChangePassword) {
    return <AppBootstrapSplash status="redirecting" />;
  }

  return <ChangePasswordForm />;
}

export default function RedefinirSenhaPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<AppBootstrapSplash status="connecting" />}>
        <RedefinirSenhaPageInner />
      </Suspense>
    </AuthProvider>
  );
}

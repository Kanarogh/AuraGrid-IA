"use client";

import { Suspense, useEffect } from "react";
import App from "../src/App";
import { AppErrorBoundary } from "../src/components/shared/AppErrorBoundary";
import { AuthProvider } from "../src/context/AuthContext";
import { ApiWorkspaceSync } from "../src/context/ApiWorkspaceSync";
import { ClientWorkspaceProvider } from "../src/context/ClientWorkspaceContext";
import { AuthGate } from "../src/components/auth/AuthGate";
import { NotificationProvider } from "../src/components/ui/NotificationProvider";
import { AppNavigationProvider } from "../src/lib/appRouting";
import { AppRouteBootstrap } from "../src/components/app/AppRouteBootstrap";
import { initTheme } from "../src/hooks/useTheme";
import { initAccent } from "../src/hooks/useAccent";

export default function AppShell() {
  useEffect(() => {
    initTheme();
    initAccent();
  }, []);

  return (
    <AppErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <ClientWorkspaceProvider>
            <ApiWorkspaceSync />
            <Suspense fallback={null}>
              <AppNavigationProvider>
                <AuthGate>
                  <AppRouteBootstrap />
                  <App />
                </AuthGate>
              </AppNavigationProvider>
            </Suspense>
          </ClientWorkspaceProvider>
        </AuthProvider>
      </NotificationProvider>
    </AppErrorBoundary>
  );
}

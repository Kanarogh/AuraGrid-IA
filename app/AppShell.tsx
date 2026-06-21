"use client";

import { Suspense, useEffect } from "react";
import App from "../src/App";
import { AppErrorBoundary } from "../src/components/shared/AppErrorBoundary";
import { AuthProvider } from "../src/context/AuthContext";
import { ApiWorkspaceSync } from "../src/context/ApiWorkspaceSync";
import {
  ClientWorkspaceProvider,
  useClientWorkspace,
} from "../src/context/ClientWorkspaceContext";
import { AppBootstrapGate } from "../src/components/app/AppBootstrapGate";
import { NotificationProvider } from "../src/components/ui/NotificationProvider";
import { AppNavigationProvider } from "../src/lib/appRouting";
import { AppRouteBootstrap } from "../src/components/app/AppRouteBootstrap";
import { initTheme } from "../src/hooks/useTheme";
import { initAccent } from "../src/hooks/useAccent";

function AppNavigationShell({ children }: { children: React.ReactNode }) {
  const { effectiveActiveClientId } = useClientWorkspace();
  return (
    <AppNavigationProvider defaultClientId={effectiveActiveClientId}>
      {children}
    </AppNavigationProvider>
  );
}

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
              <AppNavigationShell>
                <AppBootstrapGate>
                  <AppRouteBootstrap />
                  <App />
                </AppBootstrapGate>
              </AppNavigationShell>
            </Suspense>
          </ClientWorkspaceProvider>
        </AuthProvider>
      </NotificationProvider>
    </AppErrorBoundary>
  );
}

"use client";

import { Suspense, useEffect } from "react";
import App from "../src/App";
import { AppErrorBoundary } from "../src/components/shared/AppErrorBoundary";
import { AuthProvider } from "../src/context/AuthContext";
import { PermissionsProvider } from "../src/context/PermissionsContext";
import { ApiWorkspaceSync } from "../src/context/ApiWorkspaceSync";
import {
  ClientWorkspaceProvider,
  useClientWorkspace,
} from "../src/context/ClientWorkspaceContext";
import { AppBootstrapGate } from "../src/components/app/AppBootstrapGate";
import { NotificationProvider } from "../src/components/ui/NotificationProvider";
import { AppNavigationProvider } from "../src/lib/appRouting";
import { AppRouteBootstrap } from "../src/components/app/AppRouteBootstrap";
import { AppearanceCloudSync } from "../src/components/app/AppearanceCloudSync";
import { PlanningPeriodModalProvider } from "../src/components/layout/planningPeriodModalContext";
import { initTheme } from "../src/hooks/useTheme";
import { initAccent } from "../src/hooks/useAccent";
import "../src/lib/sync/syncDebugLog";

function AppNavigationShell({ children }: { children: React.ReactNode }) {
  const { effectiveActiveClientId } = useClientWorkspace();
  return (
    <AppNavigationProvider defaultClientId={effectiveActiveClientId}>
      <PlanningPeriodModalProvider>{children}</PlanningPeriodModalProvider>
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
          <PermissionsProvider>
          <AppearanceCloudSync />
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
          </PermissionsProvider>
        </AuthProvider>
      </NotificationProvider>
    </AppErrorBoundary>
  );
}

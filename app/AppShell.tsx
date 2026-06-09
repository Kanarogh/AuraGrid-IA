"use client";

import { useEffect } from "react";
import App from "../src/App";
import { AppErrorBoundary } from "../src/components/shared/AppErrorBoundary";
import { AuthProvider } from "../src/context/AuthContext";
import { ApiWorkspaceSync } from "../src/context/ApiWorkspaceSync";
import { ClientWorkspaceProvider } from "../src/context/ClientWorkspaceContext";
import { AuthGate } from "../src/components/auth/AuthGate";
import { initTheme } from "../src/hooks/useTheme";

export default function AppShell() {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ClientWorkspaceProvider>
          <ApiWorkspaceSync />
          <AuthGate>
            <App />
          </AuthGate>
        </ClientWorkspaceProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

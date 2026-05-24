import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary.tsx";
import { ClientWorkspaceProvider } from "./context/ClientWorkspaceContext.tsx";
import { runClientsZeroWipe } from "./lib/clientWorkspace/clearStorage.ts";
import { initTheme } from "./hooks/useTheme.ts";
import "./index.css";

runClientsZeroWipe();
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ClientWorkspaceProvider>
        <App />
      </ClientWorkspaceProvider>
    </AppErrorBoundary>
  </StrictMode>
);

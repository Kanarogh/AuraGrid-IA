"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { APP_NAME, APP_TAGLINE } from "../../lib/appBranding";
import {
  CLOUD_SAVE_EVENT,
  type CloudSaveStatus,
} from "../../lib/cloudSaveStatus";

function useCloudSaveStatus(): CloudSaveStatus {
  const { useApiStorage } = useClientWorkspace();
  const [status, setStatus] = useState<CloudSaveStatus>("idle");

  useEffect(() => {
    if (!useApiStorage) {
      setStatus("idle");
      return;
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ status: CloudSaveStatus }>).detail;
      setStatus(detail.status);
    };
    window.addEventListener(CLOUD_SAVE_EVENT, handler);
    return () => window.removeEventListener(CLOUD_SAVE_EVENT, handler);
  }, [useApiStorage]);

  useEffect(() => {
    if (status !== "saved") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  return useApiStorage ? status : "idle";
}

function cloudSaveLabel(status: CloudSaveStatus): string | null {
  switch (status) {
    case "saving":
      return "Salvando na nuvem…";
    case "saved":
      return "Salvo na nuvem";
    case "error":
      return "Erro ao salvar na nuvem";
    default:
      return null;
  }
}

export function Footer() {
  const { storageMode } = useAuth();
  const cloudStatus = useCloudSaveStatus();
  const saveLabel = cloudSaveLabel(cloudStatus);

  return (
    <footer className="px-3 sm:px-4 lg:px-5 py-5 mt-6 border-t border-ag-border flex flex-col sm:flex-row justify-between gap-3 text-xs text-ag-muted w-full">
      <span>
        © {new Date().getFullYear()}{" "}
        <span className="ag-gradient-text font-medium">{APP_NAME}</span> —{" "}
        {APP_TAGLINE.toLowerCase()}.
      </span>
      <span
        className={
          cloudStatus === "error"
            ? "text-ag-danger"
            : cloudStatus === "saved"
              ? "text-ag-success"
              : "text-ag-muted/80"
        }
      >
        {storageMode === "postgresql"
          ? saveLabel ?? "Dados na nuvem (PostgreSQL + armazenamento de mídia)."
          : "Modo dev: dados salvos localmente no navegador."}
      </span>
    </footer>
  );
}

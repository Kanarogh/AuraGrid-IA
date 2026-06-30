"use client";

import { CheckCircle2, Link2, Loader2, Share2, Unlink } from "lucide-react";
import { SUPPORTED_SOCIAL_NETWORKS_LABEL } from "../../lib/appBranding";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import type { MetaConnectionPublic } from "../../lib/publish/publishApi";
import { disconnectMeta, startMetaOAuth } from "../../lib/publish/publishApi";
import { toast } from "../../lib/toast";

export function MetaConnectionCard({
  clientId,
  connection,
  onRefresh,
  compact,
  publishMockEnabled,
}: {
  clientId: string;
  connection: MetaConnectionPublic | null;
  onRefresh: () => void;
  compact?: boolean;
  publishMockEnabled?: boolean;
}) {
  const connected = connection?.connected && connection.status === "active";
  const needsReconnect = connection?.needsReconnect;

  const handleConnect = () => startMetaOAuth(clientId);

  const handleDisconnect = async () => {
    try {
      await disconnectMeta(clientId);
      toast.success("Conta desconectada.");
      onRefresh();
    } catch {
      toast.error("Não foi possível desconectar.");
    }
  };

  if (connected && !needsReconnect) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-ag-success/30 bg-ag-success/5 p-4 flex items-center justify-between gap-3",
          compact && "p-3"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ag-text flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-ag-success shrink-0" />
              Conta conectada
            </p>
            <p className="text-xs text-ag-muted truncate">
              @{connection?.igUsername ?? "instagram"} · {connection?.pageName ?? "Página Facebook"}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
          <Unlink className="h-4 w-4" />
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ag-border bg-ag-surface-2/60 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
          <Share2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-ag-text">
            {needsReconnect ? "Reconecte suas redes sociais" : "Conecte redes sociais"}
          </h3>
          <p className="text-sm text-ag-muted mt-1 leading-relaxed">
            {needsReconnect
              ? "Sua autorização expirou. Entre novamente para continuar programando posts."
              : `Conecte as contas do cliente para publicar em ${SUPPORTED_SOCIAL_NETWORKS_LABEL}.`}
          </p>
          {publishMockEnabled && (
            <p className="text-xs text-ag-success mt-2">
              Modo simulação ativo — você pode agendar posts sem conectar agora.
            </p>
          )}
        </div>
      </div>
      <ul className="text-xs text-ag-muted space-y-1 list-disc pl-4">
        <li>Conta Business ou Creator</li>
        <li>Página do Facebook vinculada</li>
        <li>Você precisa ser administrador da Página</li>
      </ul>
      <Button type="button" variant="accent" size="md" className="w-full sm:w-auto" onClick={handleConnect}>
        <Link2 className="h-4 w-4" />
        Conectar contas sociais
      </Button>
    </div>
  );
}

export function MetaConnectionBanner({ loading }: { loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ag-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando conexão…
      </div>
    );
  }
  return null;
}

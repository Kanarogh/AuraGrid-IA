"use client";

import { CheckCircle2, Link2, Loader2, Share2, Unlink } from "lucide-react";
import {
  PUBLISH_PLATFORMS_V1,
  PLATFORM_LABELS,
  type PublishPlatform,
} from "../../lib/publish/platforms";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import {
  disconnectSocial,
  isSocialConnectionActive,
  startSocialOAuth,
  type SocialConnectionPublic,
} from "../../lib/publish/publishApi";
import { toast } from "../../lib/toast";

const PLATFORM_GRADIENT: Record<PublishPlatform, string> = {
  instagram: "from-purple-500 to-pink-500",
  facebook: "from-blue-600 to-blue-800",
  linkedin: "from-blue-700 to-sky-600",
  pinterest: "from-red-600 to-rose-700",
};

function PlatformCard({
  clientId,
  connection,
  onRefresh,
  compact,
}: {
  clientId: string;
  connection: SocialConnectionPublic;
  onRefresh: () => void;
  compact?: boolean;
}) {
  const platform = connection.platform;
  const label = PLATFORM_LABELS[platform];
  const active = isSocialConnectionActive(connection);
  const needsReconnect = connection.connected && connection.needsReconnect;

  const handleConnect = () => {
    if (platform === "instagram" || platform === "facebook") {
      startSocialOAuth(clientId, platform);
    } else if (connection.oauthConfigured) {
      startSocialOAuth(clientId, platform);
    } else {
      toast.warning(`${label} ainda não está configurado no servidor (variáveis OAuth).`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSocial(clientId, platform);
      toast.success(`${label} desconectado.`);
      onRefresh();
    } catch {
      toast.error(`Não foi possível desconectar ${label}.`);
    }
  };

  if (active) {
    return (
      <div
        className={cn(
          "rounded-xl border border-ag-success/30 bg-ag-success/5 p-3 flex items-center justify-between gap-3",
          compact && "p-2.5"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0",
              PLATFORM_GRADIENT[platform]
            )}
          >
            <Share2 className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ag-text flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-ag-success shrink-0" />
              {label}
            </p>
            <p className="text-xs text-ag-muted truncate">
              {connection.displayName ?? "Conectado"}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
          <Unlink className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ag-border bg-ag-surface-2/50 p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={cn(
            "h-9 w-9 rounded-lg bg-gradient-to-br opacity-60 flex items-center justify-center shrink-0",
            PLATFORM_GRADIENT[platform]
          )}
        >
          <Share2 className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ag-text">{label}</p>
          <p className="text-xs text-ag-muted">
            {needsReconnect
              ? "Autorização expirada — reconecte"
              : connection.oauthConfigured
                ? "Não conectado"
                : "OAuth não configurado no servidor"}
          </p>
        </div>
      </div>
      {connection.oauthConfigured && (
        <Button type="button" variant="ghost" size="sm" onClick={handleConnect}>
          <Link2 className="h-3.5 w-3.5" />
          Conectar
        </Button>
      )}
    </div>
  );
}

export function SocialConnectionsPanel({
  clientId,
  connections,
  onRefresh,
  compact,
  publishMockEnabled,
}: {
  clientId: string;
  connections: SocialConnectionPublic[];
  onRefresh: () => void;
  compact?: boolean;
  publishMockEnabled?: boolean;
}) {
  const ordered = PUBLISH_PLATFORMS_V1.map(
    (p) => connections.find((c) => c.platform === p)!
  ).filter(Boolean);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold text-ag-text">Redes sociais</h3>
        <p className="text-sm text-ag-muted mt-1">
          Conecte Instagram, Facebook, LinkedIn e Pinterest para publicar foto + legenda.
        </p>
        {publishMockEnabled && (
          <p className="text-xs text-ag-success mt-2">
            Modo simulação ativo — você pode agendar sem conectar agora.
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ordered.map((conn) => (
          <PlatformCard
            key={conn.platform}
            clientId={clientId}
            connection={conn}
            onRefresh={onRefresh}
            compact={compact}
          />
        ))}
      </div>
      <ul className="text-xs text-ag-muted space-y-1 list-disc pl-4">
        <li>Instagram/Facebook: conta Business/Creator + Página Facebook vinculada</li>
        <li>LinkedIn: perfil ou página de empresa com permissão de publicação</li>
        <li>Pinterest: escolha o board padrão nas preferências após conectar</li>
      </ul>
    </div>
  );
}

export function MetaConnectionBanner({ loading }: { loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ag-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando conexões…
      </div>
    );
  }
  return null;
}

/** @deprecated Use SocialConnectionsPanel */
export { SocialConnectionsPanel as MetaConnectionCard };

import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Loader2,
  Sparkles,
} from "lucide-react";
import { providerDisplayName } from "../../lib/aiSettings";
import { useAiSettings } from "../../hooks/useAiSettings";
import { aiQueue, type AiQueueState } from "../../lib/aiQueue";
import { getCaptionCacheStats } from "../../lib/captionCache";
import { GeminiModelPicker } from "./GeminiModelPicker";
import { geminiModelDisplayLabel } from "../../lib/geminiModelDisplay";
import { useEffect, useState } from "react";

type Stats = ReturnType<typeof getCaptionCacheStats>;

export function AiUsagePanel({
  compact = false,
  onOpenSettings,
}: {
  compact?: boolean;
  onOpenSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [queueState, setQueueState] = useState<AiQueueState>(aiQueue.getState());
  const [cacheStats, setCacheStats] = useState<Stats>(getCaptionCacheStats());

  const { settings, activeModelLabel } = useAiSettings();

  useEffect(() => {
    const unsubscribe = aiQueue.subscribe((s) => {
      setQueueState(s);
      setCacheStats(getCaptionCacheStats());
    });
    return unsubscribe;
  }, []);

  const pending = queueState.pending.length;
  const isWorking = !!queueState.inFlight;
  const providerName = providerDisplayName("gemini");

  const indicatorLabel = isWorking
    ? `IA: ${queueState.inFlight!.label}${pending > 0 ? ` (+${pending})` : ""}`
    : pending > 0
      ? `IA: ${pending} na fila`
      : settings?.gemini
        ? `IA: ${geminiModelDisplayLabel(settings.gemini)}`
        : "IA";

  const headerModelLabel = settings?.gemini
    ? geminiModelDisplayLabel(settings.gemini)
    : activeModelLabel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-1 hover:bg-ag-surface-2 cursor-pointer ${
          isWorking ? "text-ag-accent" : "text-ag-text"
        }`}
        aria-label="Status da IA"
        title={`${providerName}${headerModelLabel !== "—" ? ` · ${headerModelLabel}` : ""}`}
      >
        {isWorking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline truncate max-w-[200px]">{indicatorLabel}</span>
        <span className="sm:hidden">{isWorking ? pending + 1 : pending}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 rounded-xl border border-ag-border bg-ag-surface-1 shadow-[var(--ag-shadow-lg)] p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-1">
                Provedor ativo
              </p>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-ag-accent" />
                <p className="text-sm font-semibold text-ag-text">{providerName}</p>
                <span
                  className="ml-auto text-[10px] font-mono text-ag-muted truncate max-w-[160px]"
                  title={headerModelLabel}
                >
                  {headerModelLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <Stat icon={<Activity className="h-3 w-3" />} label="Em execução" value={isWorking ? "1" : "0"} accent={isWorking} />
              <Stat icon={<Activity className="h-3 w-3" />} label="Na fila" value={String(pending)} accent={pending > 0} />
              <Stat icon={<Sparkles className="h-3 w-3" />} label="Total na sessão" value={String(queueState.totalProcessed)} />
              <Stat icon={<Database className="h-3 w-3" />} label="Cache" value={`${cacheStats.size}/${cacheStats.capacity}`} />
            </div>

            {pending > 0 && (
              <div className="border-t border-ag-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => aiQueue.cancelPending()}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-ag-danger hover:underline cursor-pointer"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Cancelar pendentes
                </button>
              </div>
            )}

            {compact && onOpenSettings ? (
              <div className="border-t border-ag-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenSettings();
                  }}
                  className="text-xs font-semibold text-ag-accent hover:underline cursor-pointer"
                >
                  Configurar IA →
                </button>
              </div>
            ) : (
              <GeminiModelPicker variant="popover" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        accent ? "border-ag-accent/30 bg-ag-accent/10" : "border-ag-border bg-ag-surface-2"
      }`}
    >
      <p className="font-mono uppercase text-ag-muted flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? "text-ag-accent" : "text-ag-text"}`}>
        {value}
      </p>
    </div>
  );
}

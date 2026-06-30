import { CheckCircle2, AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import type { CatalogItem, MatchDiagnostics } from "../../types";
import { cn } from "../../lib/cn";

type Props = {
  diagnostics: MatchDiagnostics;
  referenceCatalog: CatalogItem[];
  currentMatchedId: string | null;
  disabled?: boolean;
  onSelectCandidate: (catalogId: string) => void;
};

const CONFIDENCE_META: Record<
  MatchDiagnostics["confidence"],
  { label: string; tone: string; Icon: typeof CheckCircle2; description: string }
> = {
  high: {
    label: "Confiança alta",
    tone: "text-ag-success bg-ag-success/10 border-ag-success/30",
    Icon: CheckCircle2,
    description: "Match confiável — peça compatível com a foto.",
  },
  medium: {
    label: "Confiança média",
    tone: "text-ag-warning bg-ag-warning/10 border-ag-warning/30",
    Icon: AlertTriangle,
    description: "Match provável — confirme se a peça está correta.",
  },
  low: {
    label: "Confiança baixa",
    tone: "text-ag-danger bg-ag-danger/10 border-ag-danger/30",
    Icon: HelpCircle,
    description: "Match incerto — revise os candidatos.",
  },
  none: {
    label: "Sem match confiável",
    tone: "text-ag-muted bg-ag-surface-2/60 border-ag-border",
    Icon: XCircle,
    description: "Nenhum candidato bateu — escolha manualmente abaixo.",
  },
};

export function MatchConfidencePanel({
  diagnostics,
  referenceCatalog,
  currentMatchedId,
  disabled,
  onSelectCandidate,
}: Props) {
  if (disabled) return null;

  if (diagnostics.knownReference) {
    const label =
      diagnostics.chosenLabel ??
      referenceCatalog.find((c) => c.id === currentMatchedId)?.label ??
      diagnostics.chosenId;
    return (
      <div className="rounded-xl border border-ag-success/30 bg-ag-success/10 p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border text-ag-success bg-ag-success/10 border-ag-success/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Referência definida
          </span>
        </div>
        <p className="text-xs text-ag-muted leading-snug">
          {label
            ? `Peça ${label} — identificada pelo nome ou vínculo manual. Match visual omitido; só a legenda foi gerada.`
            : "Referência identificada pelo nome ou vínculo manual. Match visual omitido; só a legenda foi gerada."}
        </p>
      </div>
    );
  }

  const meta = CONFIDENCE_META[diagnostics.confidence];
  const Icon = meta.Icon;
  const candidates = diagnostics.topCandidates.slice(0, 3);
  const labelById = new Map(referenceCatalog.map((c) => [c.id, c.label]));
  const showCandidates = candidates.length > 0;

  return (
    <div className="rounded-xl border border-ag-border/60 bg-ag-surface-2/30 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border",
            meta.tone
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
        {typeof diagnostics.chosenScore === "number" && (
          <span className="text-[11px] text-ag-muted font-mono">
            score {Math.round(diagnostics.chosenScore)}
            {typeof diagnostics.scoreGap === "number" && (
              <span> · gap {Math.round(diagnostics.scoreGap)}</span>
            )}
          </span>
        )}
      </div>

      <p className="text-xs text-ag-muted leading-snug">{meta.description}</p>

      {showCandidates && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
            Candidatos prováveis
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((cand) => {
              const isActive = cand.id === currentMatchedId;
              const label = labelById.get(cand.id) ?? cand.label;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => onSelectCandidate(cand.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                    isActive
                      ? "bg-ag-accent text-ag-accent-fg border-ag-accent"
                      : "bg-ag-surface-1 text-ag-text border-ag-border hover:border-ag-accent/50 hover:bg-ag-accent/5"
                  )}
                  title={`score ${Math.round(cand.score)} · padrão ${cand.pattern} · âncoras ${cand.anchors}${
                    cand.penalty ? ` · penalidade ${cand.penalty}` : ""
                  }`}
                >
                  <span className="truncate max-w-[160px]">{label}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      isActive ? "text-ag-accent-fg opacity-90" : "text-ag-muted"
                    )}
                  >
                    {Math.round(cand.score)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {diagnostics.rejectReasons.length > 0 && (
        <details className="group">
          <summary className="text-[11px] text-ag-muted cursor-pointer hover:text-ag-text list-none flex items-center gap-1">
            <span className="text-[10px] uppercase font-mono tracking-widest">
              Por que a IA não confirmou?
            </span>
          </summary>
          <ul className="mt-1.5 pl-3 space-y-0.5 text-[11px] text-ag-muted leading-snug list-disc">
            {diagnostics.rejectReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

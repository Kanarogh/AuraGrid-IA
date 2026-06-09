import { Copy, Check } from "lucide-react";
import { useMemo, useState } from "react";
import type { CatalogItem } from "../../types";
import { normalizeVisualProfile } from "../../lib/catalog";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function CatalogProfileModal({
  item,
  onClose,
}: {
  item: CatalogItem | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const profile = useMemo(
    () =>
      item?.visualProfile
        ? normalizeVisualProfile(item.visualProfile, item.label)
        : null,
    [item?.visualProfile, item?.label]
  );

  if (!item || !profile) return null;

  const jsonText = JSON.stringify(profile, null, 2);
  const colors =
    profile.primaryColors.length > 0
      ? profile.primaryColors.join(", ")
      : profile.secondaryColors.length > 0
        ? profile.secondaryColors.join(", ")
        : "—";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`Perfil — ${item.label}`}
      size="lg"
      footer={
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar JSON"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <SummaryRow label="Tipo" value={profile.garmentType} />
          <SummaryRow label="Categoria" value={profile.category} />
          <SummaryRow
            label="Cor dominante"
            value={profile.dominantColorFamily ?? colors}
          />
          <SummaryRow label="Cores" value={colors} />
          <SummaryRow
            label="Estampa"
            value={`${profile.pattern.type}${profile.printScale ? ` (${profile.printScale})` : ""} — ${profile.pattern.description}`}
          />
          <SummaryRow label="Decote" value={profile.neckline} />
          <SummaryRow label="Mangas" value={profile.sleeves} />
          <SummaryRow label="Comprimento" value={profile.dressLength} />
          <SummaryRow label="Silhueta" value={profile.silhouette} />
        </div>

        <div className="text-xs space-y-2">
          <p className="text-ag-muted font-mono uppercase tracking-wider text-[10px]">
            Resumo visual
          </p>
          <p className="text-ag-text leading-relaxed">{profile.visualSummary}</p>
          <p className="text-ag-accent font-medium border-l-2 border-ag-accent pl-3">
            {profile.distinguishingFingerprint}
          </p>
        </div>

        {profile.matchAnchors && profile.matchAnchors.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase text-ag-muted mb-1.5">
              Âncoras de match
            </p>
            <ul className="text-xs text-ag-text space-y-1 list-disc pl-4">
              {profile.matchAnchors.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {profile.notToConfuseWith && (
          <p className="text-xs text-ag-muted border-l-2 border-amber-500/50 pl-3">
            {profile.notToConfuseWith}
          </p>
        )}

        {profile.distinctiveDetails.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.distinctiveDetails.map((d) => (
              <span
                key={d}
                className="text-[10px] px-2 py-0.5 rounded-full bg-ag-accent-soft text-ag-accent border border-ag-accent/20"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {profile.matchKeywords.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase text-ag-muted mb-1.5">Palavras-chave</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.matchKeywords.map((k) => (
                <span
                  key={k}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-ag-surface-2 border border-ag-border text-ag-muted"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        <details className="group">
          <summary className="text-xs font-semibold text-ag-muted cursor-pointer hover:text-ag-text">
            JSON completo
          </summary>
          <pre className="mt-2 p-3 rounded-xl bg-ag-surface-2 border border-ag-border text-[10px] font-mono overflow-x-auto max-h-48 text-ag-text">
            {jsonText}
          </pre>
        </details>

        {item.enrichedAt && (
          <p className="text-[10px] text-ag-muted">
            Indexado em {new Date(item.enrichedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-ag-surface-2 border border-ag-border">
      <span className="text-[10px] font-mono uppercase text-ag-muted block">{label}</span>
      <span className="text-ag-text font-medium">{value}</span>
    </div>
  );
}

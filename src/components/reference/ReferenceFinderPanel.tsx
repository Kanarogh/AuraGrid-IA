import { useCallback, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  ImagePlus,
  Loader2,
  ScanSearch,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import type { CatalogItem } from "../../types";
import { catalogReadyForTextMatch } from "../../lib/catalogEnrichment";
import { isCatalogItemIndexed } from "../../lib/catalog";
import { matchReferenceOnServer } from "../../lib/matchReference";
import { isAbortError } from "../../lib/catalogEnrichment";
import { resizeForAi } from "../../lib/images";
import { StudioSection } from "../ui/StudioSection";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AiErrorBanner } from "../shared/AiErrorBanner";
import { EmptyState } from "../ui/EmptyState";
import { cn } from "../../lib/cn";
import { getSectionBreadcrumb } from "../../lib/sectionMeta";

async function readImageFile(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return resizeForAi(raw);
}

export function ReferenceFinderPanel({
  referenceCatalog,
  isEnrichingCatalog,
  onNavigateCatalog,
  onEnsureCatalogIndexed,
  onViewProfile,
  clientId,
}: {
  referenceCatalog: CatalogItem[];
  isEnrichingCatalog: boolean;
  onNavigateCatalog: () => void;
  onEnsureCatalogIndexed: () => Promise<boolean>;
  onViewProfile?: (item: CatalogItem) => void;
  /** Necessário para shortlist por embedding no servidor (API storage). */
  clientId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [queryImage, setQueryImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const indexedCount = useMemo(
    () => referenceCatalog.filter(isCatalogItemIndexed).length,
    [referenceCatalog]
  );
  const catalogReady = catalogReadyForTextMatch(referenceCatalog);

  const effectiveId = manualId || matchedId;
  const matchedItem = useMemo(
    () => referenceCatalog.find((c) => c.id === effectiveId) ?? null,
    [referenceCatalog, effectiveId]
  );

  const resetResult = () => {
    setMatchedId(null);
    setReasoning(null);
    setManualId("");
    setError(null);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name)) {
      return;
    }
    resetResult();
    try {
      const dataUrl = await readImageFile(file);
      setQueryImage(dataUrl);
    } catch {
      setError("Não foi possível ler a imagem.");
    }
  }, []);

  const stopSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSearching(false);
  };

  const runSearch = async () => {
    if (!queryImage) {
      setError("Envie uma foto antes de buscar.");
      return;
    }
    if (referenceCatalog.length === 0) {
      setError("O catálogo está vazio. Adicione referências na aba Catálogo.");
      return;
    }

    const ok = await onEnsureCatalogIndexed();
    if (!ok) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setError(null);
    resetResult();

    try {
      const result = await matchReferenceOnServer(queryImage, referenceCatalog, controller.signal, {
        clientId,
      });
      if (controller.signal.aborted) return;
      setMatchedId(result.matchedId);
      setReasoning(result.reasoning || null);
      setManualId(result.matchedId ?? "");
    } catch (err: unknown) {
      if (isAbortError(err) || controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Falha ao buscar referência.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsSearching(false);
      }
    }
  };

  const handleCopyLabel = async () => {
    if (!matchedItem?.label) return;
    await navigator.clipboard.writeText(matchedItem.label);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StudioSection
      title="Buscar referência"
      titleMode="nested"
      eyebrow={getSectionBreadcrumb("reference_finder")}
      actions={
        <Badge tone={catalogReady ? "success" : "warning"} dot>
          {indexedCount}/{referenceCatalog.length} indexadas
          {isEnrichingCatalog ? " · indexando…" : ""}
        </Badge>
      }
    >
      <p className="text-sm text-ag-muted leading-relaxed max-w-3xl mb-6">
        Envie uma foto e a IA identifica qual referência do catálogo corresponde —
        sem gerar legenda. Use o mesmo índice JSON do catálogo (mais rápido e preciso).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed min-h-[280px] cursor-pointer transition-colors",
              dragOver
                ? "border-ag-accent bg-ag-accent/5"
                : "border-ag-border bg-ag-surface-2/50 hover:border-ag-accent/50"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            {queryImage ? (
              <>
                <img
                  src={queryImage}
                  alt="Foto para busca"
                  className="max-h-[240px] max-w-full object-contain rounded-lg shadow-[var(--ag-shadow)]"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQueryImage(null);
                    resetResult();
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-ag-surface-1/90 border border-ag-border text-ag-muted hover:text-ag-text cursor-pointer"
                  aria-label="Remover foto"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <ImagePlus className="h-10 w-10 text-ag-muted" />
                <p className="text-sm text-ag-muted text-center px-4">
                  Clique ou arraste uma imagem aqui
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => void runSearch()}
              disabled={!queryImage || isSearching || referenceCatalog.length === 0}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              {isSearching ? "Buscando…" : "Buscar referência"}
            </Button>
            {isSearching && (
              <Button variant="secondary" onClick={stopSearch}>
                Parar
              </Button>
            )}
          </div>

          {!catalogReady && referenceCatalog.length > 0 && (
            <p className="text-xs text-ag-muted leading-relaxed">
              Indexe todas as referências no{" "}
              <button
                type="button"
                onClick={onNavigateCatalog}
                className="text-ag-accent hover:underline cursor-pointer font-medium"
              >
                Catálogo
              </button>{" "}
              para match por JSON (recomendado). Sem índice, a IA pode comparar só algumas fotos do
              acervo.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-ag-border bg-ag-surface-2/40 p-4 min-h-[200px]">
            <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-3">
              Resultado
            </p>

            {error && <AiErrorBanner message={error} onRetry={() => void runSearch()} />}

            {!error && !isSearching && !effectiveId && reasoning && (
              <p className="text-sm text-ag-muted">
                Nenhuma referência correspondente com confiança. Ajuste manualmente abaixo ou tente
                outra foto.
              </p>
            )}

            {!error && !isSearching && effectiveId && matchedItem && (
              <div className="flex gap-4">
                <img
                  src={matchedItem.image ?? undefined}
                  alt={matchedItem.label}
                  className="w-24 h-32 object-cover rounded-lg border border-ag-border shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-display text-xl font-semibold text-ag-text leading-tight">
                    {matchedItem.label}
                  </p>
                  {reasoning && (
                    <p className="text-xs text-ag-muted leading-relaxed border-l-2 border-ag-accent/40 pl-3">
                      {reasoning}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" size="sm" onClick={() => void handleCopyLabel()}>
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar código
                    </Button>
                    {matchedItem.visualProfile && onViewProfile && (
                      <Button variant="secondary" size="sm" onClick={() => onViewProfile(matchedItem)}>
                        Ver perfil JSON
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!error && !isSearching && !effectiveId && !reasoning && (
              <EmptyState
                icon={ScanSearch}
                title="Aguardando busca"
                description="O código da referência e a análise da IA aparecem aqui após enviar uma foto."
                compact
              />
            )}

            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-ag-muted">
                <Sparkles className="h-4 w-4 text-ag-accent animate-pulse" />
                Comparando com o catálogo…
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-ag-muted block mb-2">
              Ajustar manualmente
            </label>
            <select
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="w-full rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2 text-sm text-ag-text"
            >
              <option value="">— Nenhuma referência —</option>
              {referenceCatalog.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {referenceCatalog.length === 0 && (
            <Button variant="secondary" onClick={onNavigateCatalog}>
              <ShoppingBag className="h-4 w-4" />
              Ir ao catálogo
            </Button>
          )}
        </div>
      </div>
    </StudioSection>
  );
}

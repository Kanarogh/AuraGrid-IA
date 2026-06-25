import { useCallback, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type {
  BrandGem,
  ContentScheduleItem,
  ContentScheduleItemStatus,
  PlannedPost,
} from "../../types";
import { aiFetch } from "../../lib/aiFetch";
import { aiQueue } from "../../lib/aiQueue";
import {
  CONTENT_SCHEDULE_STATUS_LABELS,
  formatFullSchedule,
  formatScheduleItemCopy,
} from "../../lib/contentSchedule/format";
import { pushScheduleToPlanning } from "../../lib/contentSchedule/pushToPlanning";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { WorkflowStepper, type WorkflowStep } from "../layout/WorkflowStepper";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { AiErrorBanner } from "../shared/AiErrorBanner";

type ContentScheduleWorkspaceProps = {
  items: ContentScheduleItem[];
  brandGem: BrandGem;
  brandGemReady: boolean;
  startDate: string;
  periodLabel?: string;
  isReadOnly?: boolean;
  posts: PlannedPost[];
  onItemsChange: (items: ContentScheduleItem[]) => void;
  onPushToPlanning: (posts: PlannedPost[], items: ContentScheduleItem[]) => void;
};

const STATUS_TONE: Record<
  ContentScheduleItemStatus,
  "neutral" | "success" | "warning" | "accent"
> = {
  draft: "neutral",
  approved: "success",
  handed_off: "warning",
  done: "accent",
};

function statusBadgeTone(status: ContentScheduleItemStatus) {
  return STATUS_TONE[status] ?? "neutral";
}

export function ContentScheduleWorkspace({
  items,
  brandGem,
  brandGemReady,
  startDate,
  periodLabel,
  isReadOnly,
  posts,
  onItemsChange,
  onPushToPlanning,
}: ContentScheduleWorkspaceProps) {
  const [clientBrief, setClientBrief] = useState("");
  const [postCount, setPostCount] = useState(9);
  const [storyCount, setStoryCount] = useState(12);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const postsItems = useMemo(
    () => items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order),
    [items]
  );
  const storiesItems = useMemo(
    () => items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order),
    [items]
  );

  const approvedCount = items.filter((i) => i.status === "approved").length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "handed_off").length;
  const hasItems = items.length > 0;

  const workflowSteps: WorkflowStep[] = [
    { id: "brief", label: "Briefing", done: hasItems || clientBrief.trim().length > 20, active: !hasItems },
    { id: "gen", label: "Gerar", done: hasItems, active: !hasItems && clientBrief.trim().length > 0 },
    { id: "review", label: "Revisar", done: approvedCount > 0, active: hasItems && approvedCount === 0 },
    {
      id: "handoff",
      label: "Handoff",
      done: doneCount > 0,
      active: approvedCount > 0 && doneCount === 0,
    },
  ];

  const updateItem = useCallback(
    (id: string, patch: Partial<ContentScheduleItem>) => {
      onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [items, onItemsChange]
  );

  const handleGenerate = useCallback(async () => {
    if (!brandGemReady) {
      toast.error("Configure o Gem da marca antes de gerar o cronograma.");
      return;
    }
    setGenerating(true);
    setAiError(null);
    try {
      const res = await aiQueue.enqueue("Gerar cronograma", () =>
        aiFetch("/api/generate-content-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandGem,
            clientBrief,
            mode: "monthly",
            options: {
              postCount,
              storyCount,
              startDate,
              extraInstructions,
            },
          }),
        })
      );
      const data = (await res.json()) as { items?: ContentScheduleItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar cronograma.");
      if (!data.items?.length) throw new Error("A IA não retornou itens.");
      onItemsChange(data.items);
      setSelectedId(data.items[0]?.id ?? null);
      toast.success(`Cronograma gerado: ${data.items.length} itens.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }, [
    brandGem,
    brandGemReady,
    clientBrief,
    extraInstructions,
    onItemsChange,
    postCount,
    startDate,
    storyCount,
  ]);

  const handleRefine = useCallback(async () => {
    if (!selectedItem || !refineInstruction.trim()) return;
    setRefining(true);
    setAiError(null);
    try {
      const res = await aiQueue.enqueue("Refinar item do cronograma", () =>
        aiFetch("/api/generate-content-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandGem,
            mode: "refine_one",
            existingItem: selectedItem,
            refineInstruction,
          }),
        })
      );
      const data = (await res.json()) as { items?: ContentScheduleItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao refinar item.");
      const refined = data.items?.[0];
      if (!refined) throw new Error("Item refinado vazio.");
      updateItem(selectedItem.id, refined);
      toast.success("Item refinado.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(msg);
    } finally {
      setRefining(false);
    }
  }, [brandGem, refineInstruction, selectedItem, updateItem]);

  const copyText = useCallback(async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, []);

  const handlePushToPlanning = useCallback(() => {
    const result = pushScheduleToPlanning(items, posts, startDate);
    if (result.pushedCount === 0) {
      toast.error("Nenhum item aprovado para enviar. Aprove os itens primeiro.");
      return;
    }
    onPushToPlanning(result.posts, result.items);
    toast.success(
      `${result.pushedCount} item(ns) enviado(s) ao planejamento.` +
        (result.skippedCount ? ` ${result.skippedCount} ignorado(s).` : "")
    );
  }, [items, onPushToPlanning, posts, startDate]);

  const handleExportTxt = useCallback(() => {
    const text = formatFullSchedule(items, periodLabel);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma-${periodLabel?.replace(/\s+/g, "-") ?? "conteudo"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, periodLabel]);

  return (
    <div className="ag-workspace-section space-y-5">
      <WorkflowStepper steps={workflowSteps} />

      {aiError && (
        <AiErrorBanner message={aiError} onRetry={() => setAiError(null)} />
      )}

      <WorkspaceCard variant="primary">
        <WorkspaceCardHeader
          title="Briefing do mês"
          subtitle="Cole a mensagem ou direcionamento do cliente. A IA gera posts e stories com copy estruturado."
        />
        <textarea
          value={clientBrief}
          onChange={(e) => setClientBrief(e.target.value)}
          disabled={isReadOnly || generating}
          rows={5}
          placeholder="Ex.: Quero focar este mês em PDV offline, gestão de estoque e datas sazonais..."
          className="w-full rounded-xl border border-ag-border/70 bg-ag-surface-2/60 px-4 py-3 text-sm text-ag-text placeholder:text-ag-muted focus:outline-none focus:ring-2 focus:ring-ag-accent/40 resize-y min-h-[120px]"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-xs text-ag-muted">
            Posts de arte
            <input
              type="number"
              min={1}
              max={30}
              value={postCount}
              onChange={(e) => setPostCount(Number(e.target.value) || 9)}
              disabled={isReadOnly || generating}
              className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-ag-muted">
            Stories
            <input
              type="number"
              min={1}
              max={30}
              value={storyCount}
              onChange={(e) => setStoryCount(Number(e.target.value) || 12)}
              disabled={isReadOnly || generating}
              className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-ag-muted">
            Início do mês
            <input
              type="date"
              value={startDate}
              readOnly
              className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-3 px-3 py-2 text-sm text-ag-muted"
            />
          </label>
        </div>
        <label className="mt-4 block text-xs text-ag-muted">
          Instruções extras (opcional)
          <input
            type="text"
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            disabled={isReadOnly || generating}
            placeholder="Ex.: 3 posts sobre estoque, tom mais direto..."
            className="mt-1 w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isReadOnly || generating || !brandGemReady}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar cronograma com IA
          </Button>
        </div>
      </WorkspaceCard>

      {hasItems && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ag-border/60 bg-ag-surface-2/60 px-4 py-3">
            <p className="text-sm text-ag-muted">
              <span className="font-medium text-ag-text">{items.length}</span> itens ·{" "}
              <span className="font-medium text-ag-success">{approvedCount}</span> aprovados ·{" "}
              <span className="font-medium text-ag-text">{doneCount}</span> entregues
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyText(formatFullSchedule(items, periodLabel))}>
                <Copy className="h-4 w-4" />
                Copiar tudo
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleExportTxt}>
                <Download className="h-4 w-4" />
                Exportar TXT
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePushToPlanning}
                disabled={isReadOnly || approvedCount === 0}
              >
                <Send className="h-4 w-4" />
                Enviar ao Planejamento
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ScheduleColumn
              title={`Posts de Arte (${postsItems.length})`}
              items={postsItems}
              selectedId={selectedId}
              copiedId={copiedId}
              isReadOnly={isReadOnly}
              onSelect={setSelectedId}
              onCopy={(item) => void copyText(formatScheduleItemCopy(item), item.id)}
              onApprove={(id) => updateItem(id, { status: "approved" })}
              onMarkDone={(id) => updateItem(id, { status: "done" })}
            />
            <ScheduleColumn
              title={`Stories (${storiesItems.length})`}
              items={storiesItems}
              selectedId={selectedId}
              copiedId={copiedId}
              isReadOnly={isReadOnly}
              onSelect={setSelectedId}
              onCopy={(item) => void copyText(formatScheduleItemCopy(item), item.id)}
              onApprove={(id) => updateItem(id, { status: "approved" })}
              onMarkDone={(id) => updateItem(id, { status: "done" })}
            />
          </div>
        </>
      )}

      {selectedItem && (
        <ScheduleItemEditor
          item={selectedItem}
          isReadOnly={isReadOnly}
          refining={refining}
          refineInstruction={refineInstruction}
          onRefineInstructionChange={setRefineInstruction}
          onClose={() => setSelectedId(null)}
          onChange={(patch) => updateItem(selectedItem.id, patch)}
          onRefine={() => void handleRefine()}
          onCopy={() => void copyText(formatScheduleItemCopy(selectedItem), selectedItem.id)}
        />
      )}
    </div>
  );
}

function ScheduleColumn({
  title,
  items,
  selectedId,
  copiedId,
  isReadOnly,
  onSelect,
  onCopy,
  onApprove,
  onMarkDone,
}: {
  title: string;
  items: ContentScheduleItem[];
  selectedId: string | null;
  copiedId: string | null;
  isReadOnly?: boolean;
  onSelect: (id: string) => void;
  onCopy: (item: ContentScheduleItem) => void;
  onApprove: (id: string) => void;
  onMarkDone: (id: string) => void;
}) {
  return (
    <WorkspaceCard variant="secondary" padding={false}>
      <div className="border-b border-ag-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-ag-text">{title}</h3>
      </div>
      <ul className="divide-y divide-ag-border/50 max-h-[520px] overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full text-left px-4 py-3 transition-colors hover:bg-ag-surface-3/50",
                selectedId === item.id && "bg-ag-accent/10"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ag-text truncate">{item.name}</p>
                  <p className="text-xs text-ag-muted mt-0.5">
                    {item.postType}
                    {item.scheduledDate ? ` · ${item.scheduledDate}` : ""}
                  </p>
                  <p className="text-xs text-ag-text/80 mt-2 line-clamp-2">{item.headline}</p>
                </div>
                <Badge tone={statusBadgeTone(item.status)}>
                  {CONTENT_SCHEDULE_STATUS_LABELS[item.status]}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button type="button" variant="ghost" size="sm" onClick={() => onCopy(item)}>
                  {copiedId === item.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </Button>
                {!isReadOnly && item.status === "draft" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onApprove(item.id)}>
                    Aprovar
                  </Button>
                )}
                {!isReadOnly && item.status !== "done" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onMarkDone(item.id)}>
                    Feito
                  </Button>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </WorkspaceCard>
  );
}

function ScheduleItemEditor({
  item,
  isReadOnly,
  refining,
  refineInstruction,
  onRefineInstructionChange,
  onClose,
  onChange,
  onRefine,
  onCopy,
}: {
  item: ContentScheduleItem;
  isReadOnly?: boolean;
  refining: boolean;
  refineInstruction: string;
  onRefineInstructionChange: (v: string) => void;
  onClose: () => void;
  onChange: (patch: Partial<ContentScheduleItem>) => void;
  onRefine: () => void;
  onCopy: () => void;
}) {
  const fieldClass =
    "w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm text-ag-text focus:outline-none focus:ring-2 focus:ring-ag-accent/40";

  return (
    <WorkspaceCard variant="primary" className="relative">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-1 rounded-lg text-ag-muted hover:text-ag-text hover:bg-ag-surface-3"
        aria-label="Fechar editor"
      >
        <X className="h-4 w-4" />
      </button>
      <WorkspaceCardHeader
        title={item.name}
        subtitle={`${item.postType} · ${CONTENT_SCHEDULE_STATUS_LABELS[item.status]}`}
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ag-muted sm:col-span-2">
          Nome
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.name}
            disabled={isReadOnly}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted">
          Formato
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.postType}
            disabled={isReadOnly}
            onChange={(e) => onChange({ postType: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted">
          Data (DD/MM)
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.scheduledDate ?? ""}
            disabled={isReadOnly}
            onChange={(e) => onChange({ scheduledDate: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted sm:col-span-2">
          Headline
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.headline}
            disabled={isReadOnly}
            onChange={(e) => onChange({ headline: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted sm:col-span-2">
          Frase de Apoio
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.subtitle}
            disabled={isReadOnly}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted sm:col-span-2">
          CTA
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.cta}
            disabled={isReadOnly}
            onChange={(e) => onChange({ cta: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted sm:col-span-2">
          Legenda
          <textarea
            className={cn(fieldClass, "mt-1 min-h-[100px] resize-y")}
            value={item.legenda}
            disabled={isReadOnly}
            onChange={(e) => onChange({ legenda: e.target.value })}
          />
        </label>
        <label className="text-xs text-ag-muted sm:col-span-2">
          Hashtags
          <input
            className={cn(fieldClass, "mt-1")}
            value={item.hashtags}
            disabled={isReadOnly}
            onChange={(e) => onChange({ hashtags: e.target.value })}
          />
        </label>
        {item.section === "stories" && (
          <>
            <label className="text-xs text-ag-muted">
              Enquete A
              <input
                className={cn(fieldClass, "mt-1")}
                value={item.storyExtras?.pollOptions?.[0] ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  onChange({
                    storyExtras: {
                      ...item.storyExtras,
                      pollOptions: [
                        e.target.value,
                        item.storyExtras?.pollOptions?.[1] ?? "",
                      ],
                    },
                  })
                }
              />
            </label>
            <label className="text-xs text-ag-muted">
              Enquete B
              <input
                className={cn(fieldClass, "mt-1")}
                value={item.storyExtras?.pollOptions?.[1] ?? ""}
                disabled={isReadOnly}
                onChange={(e) =>
                  onChange({
                    storyExtras: {
                      ...item.storyExtras,
                      pollOptions: [
                        item.storyExtras?.pollOptions?.[0] ?? "",
                        e.target.value,
                      ],
                    },
                  })
                }
              />
            </label>
          </>
        )}
      </div>
      {!isReadOnly && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={refineInstruction}
            onChange={(e) => onRefineInstructionChange(e.target.value)}
            placeholder="Refinar com IA: ex. tom mais direto, foco em offline..."
            className={cn(fieldClass, "flex-1")}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onRefine}
            disabled={refining || !refineInstruction.trim()}
          >
            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Refinar
          </Button>
        </div>
      )}
    </WorkspaceCard>
  );
}

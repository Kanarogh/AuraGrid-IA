import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type {
  BrandGem,
  ContentScheduleItem,
  ContentScheduleSection,
  PlannedPost,
} from "../../types";
import type { ContentScheduleOptions } from "../../lib/clientWorkspace/types";
import { DEFAULT_CONTENT_SCHEDULE_OPTIONS } from "../../lib/clientWorkspace/types";
import { aiFetch } from "../../lib/aiFetch";
import { readJsonResponse } from "../../lib/apiResponse";
import { aiQueue } from "../../lib/aiQueue";
import { formatFullSchedule, formatScheduleItemCopy } from "../../lib/contentSchedule/format";
import { exportContentSchedulePdf } from "../../lib/exportContentSchedulePdf";
import { exportContentScheduleDocx } from "../../lib/exportContentScheduleDocx";
import { pushScheduleToPlanning } from "../../lib/contentSchedule/pushToPlanning";
import {
  brandGemFieldLabel,
  brandGemRequiredMessage,
  getMissingBrandGemFields,
} from "../../lib/brandGemValidation";
import { confirmDialog } from "../../lib/confirmDialog";
import { toast } from "../../lib/toast";
import { WorkflowStepper, type WorkflowStep } from "../layout/WorkflowStepper";
import { WorkspaceHero } from "../layout/WorkspaceHero";
import { AiErrorBanner } from "../shared/AiErrorBanner";
import { ScheduleBriefingPanel } from "./ScheduleBriefingPanel";
import { ScheduleGeneratingState, ScheduleBoardSkeleton } from "./ScheduleGeneratingState";
import { ScheduleProgressSummary } from "./ScheduleProgressSummary";
import { ScheduleBulkActions } from "./ScheduleBulkActions";
import { ScheduleBoard } from "./ScheduleBoard";
import { ScheduleEditorPanel, ScheduleEditorEmpty } from "./ScheduleEditorPanel";
import { ScheduleSplitLayout } from "./ScheduleSplitLayout";

type ContentScheduleWorkspaceProps = {
  items: ContentScheduleItem[];
  brandGem: BrandGem;
  brandGemReady: boolean;
  startDate: string;
  periodLabel?: string;
  brandName?: string;
  clientId?: string;
  isReadOnly?: boolean;
  posts: PlannedPost[];
  clientBrief: string;
  onClientBriefChange: (brief: string) => void;
  scheduleOptions?: ContentScheduleOptions;
  onScheduleOptionsChange?: (options: ContentScheduleOptions) => void;
  onItemsChange: (items: ContentScheduleItem[]) => void;
  onPushToPlanning: (posts: PlannedPost[], items: ContentScheduleItem[]) => void;
  onConfigureGem?: () => void;
};

export function ContentScheduleWorkspace({
  items,
  brandGem,
  brandGemReady,
  startDate,
  periodLabel,
  brandName,
  clientId,
  isReadOnly,
  posts,
  clientBrief,
  onClientBriefChange,
  scheduleOptions,
  onScheduleOptionsChange,
  onItemsChange,
  onPushToPlanning,
  onConfigureGem,
}: ContentScheduleWorkspaceProps) {
  const resolvedOptions = scheduleOptions ?? DEFAULT_CONTENT_SCHEDULE_OPTIONS;
  const hasGeneratedSchedule = items.length > 0;

  const [briefDraft, setBriefDraft] = useState("");
  const [postCount, setPostCount] = useState(DEFAULT_CONTENT_SCHEDULE_OPTIONS.postCount);
  const [storyCount, setStoryCount] = useState(DEFAULT_CONTENT_SCHEDULE_OPTIONS.storyCount);
  const [extraInstructions, setExtraInstructions] = useState("");

  useEffect(() => {
    if (!hasGeneratedSchedule) {
      setBriefDraft("");
      setPostCount(DEFAULT_CONTENT_SCHEDULE_OPTIONS.postCount);
      setStoryCount(DEFAULT_CONTENT_SCHEDULE_OPTIONS.storyCount);
      setExtraInstructions("");
      return;
    }
    setBriefDraft(clientBrief);
    setPostCount(resolvedOptions.postCount);
    setStoryCount(resolvedOptions.storyCount);
    setExtraInstructions(resolvedOptions.extraInstructions);
  }, [
    hasGeneratedSchedule,
    clientBrief,
    resolvedOptions.postCount,
    resolvedOptions.storyCount,
    resolvedOptions.extraInstructions,
  ]);

  useEffect(() => {
    if (isReadOnly || hasGeneratedSchedule) return;
    const staleBrief = clientBrief.trim().length > 0;
    const staleExtra = resolvedOptions.extraInstructions.trim().length > 0;
    if (!staleBrief && !staleExtra) return;
    onClientBriefChange("");
    onScheduleOptionsChange?.({ ...DEFAULT_CONTENT_SCHEDULE_OPTIONS });
  }, [
    clientBrief,
    hasGeneratedSchedule,
    isReadOnly,
    onClientBriefChange,
    onScheduleOptionsChange,
    resolvedOptions.extraInstructions,
  ]);

  const persistBriefAndOptions = useCallback(() => {
    if (briefDraft !== clientBrief) onClientBriefChange(briefDraft);
    onScheduleOptionsChange?.({ postCount, storyCount, extraInstructions });
  }, [
    briefDraft,
    clientBrief,
    extraInstructions,
    onClientBriefChange,
    onScheduleOptionsChange,
    postCount,
    storyCount,
  ]);

  const [generating, setGenerating] = useState(false);
  const [creatingSingle, setCreatingSingle] = useState<ContentScheduleSection | null>(null);
  const [singleItemTheme, setSingleItemTheme] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [strengthening, setStrengthening] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [briefingPanelOpen, setBriefingPanelOpen] = useState(true);
  const briefingOpenedManually = useRef(false);
  const briefingPanelRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const postsItems = useMemo(
    () => items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order),
    [items]
  );
  const storiesItems = useMemo(
    () => items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order),
    [items]
  );

  const draftCount = items.filter((i) => i.status === "draft").length;
  const approvedCount = items.filter((i) => i.status === "approved").length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "handed_off").length;
  const hasItems = items.length > 0;
  const hasBrief = briefDraft.trim().length > 0;

  // Oculta briefing após gerar; usuário reabre clicando no passo "Briefing".
  useEffect(() => {
    if (!hasItems) {
      briefingOpenedManually.current = false;
      setBriefingPanelOpen(true);
      return;
    }
    if (generating) return;
    if (!briefingOpenedManually.current) {
      setBriefingPanelOpen(false);
    }
  }, [hasItems, generating]);

  const missingGemFields = useMemo(() => getMissingBrandGemFields(brandGem), [brandGem]);
  const missingGemLabels = useMemo(
    () => missingGemFields.map(brandGemFieldLabel),
    [missingGemFields]
  );

  const workflowSteps: WorkflowStep[] = [
    {
      id: "brief",
      label: "Briefing",
      description: "Direcionamento e temas do mês",
      done: hasItems || briefDraft.trim().length > 20,
      active: !hasItems && !generating,
      selected: briefingPanelOpen && hasItems,
    },
    {
      id: "gen",
      label: "Gerar",
      description: "IA cria posts e stories",
      done: hasItems,
      active: generating || (!hasItems && briefDraft.trim().length > 0 && brandGemReady),
      selected: briefingPanelOpen && hasItems,
    },
    {
      id: "review",
      label: "Revisar",
      description: "Aprovar e ajustar copy",
      done: approvedCount > 0,
      active: hasItems && approvedCount === 0 && !generating,
    },
    {
      id: "handoff",
      label: "Enviar",
      description: "Mandar ao planejamento",
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
      toast.error(brandGemRequiredMessage(brandGem) || "Configure o Gem da marca antes de gerar.");
      return;
    }
    if (!briefDraft.trim()) {
      toast.error("Preencha o briefing do mês antes de gerar.");
      return;
    }
    if (hasGeneratedSchedule) {
      const ok = await confirmDialog({
        title: "Regenerar cronograma",
        message:
          "O cronograma atual será substituído pelo novo. Itens já enviados ao planejamento não são revertidos automaticamente.",
        confirmLabel: "Regenerar",
      });
      if (!ok) return;
    }
    setGenerating(true);
    setAiError(null);
    setSelectedId(null);
    try {
      const res = await aiQueue.enqueue("Gerar cronograma", () =>
        aiFetch("/api/generate-content-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandGem,
            clientBrief: briefDraft,
            ...(clientId ? { clientId } : {}),
            mode: "monthly",
            options: { postCount, storyCount, startDate, extraInstructions },
          }),
        })
      );
      const data = await readJsonResponse<{ items?: ContentScheduleItem[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar cronograma.");
      if (!data.items?.length) throw new Error("A IA não retornou itens.");
      persistBriefAndOptions();
      onItemsChange(data.items);
      setSelectedId(data.items[0]?.id ?? null);
      briefingOpenedManually.current = false;
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
    briefDraft,
    clientId,
    extraInstructions,
    onItemsChange,
    persistBriefAndOptions,
    postCount,
    startDate,
    storyCount,
    hasGeneratedSchedule,
  ]);

  const handleClearSchedule = useCallback(async () => {
    if (!hasGeneratedSchedule) return;
    const ok = await confirmDialog({
      title: "Excluir cronograma",
      message: "Remove todos os itens e limpa o briefing salvo. Itens no planejamento não são revertidos.",
      variant: "danger",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    onItemsChange([]);
    onClientBriefChange("");
    onScheduleOptionsChange?.({ ...DEFAULT_CONTENT_SCHEDULE_OPTIONS });
    setSelectedId(null);
    setBriefingPanelOpen(true);
    briefingOpenedManually.current = false;
    setAiError(null);
    toast.success("Cronograma excluído.");
  }, [hasGeneratedSchedule, onClientBriefChange, onItemsChange, onScheduleOptionsChange]);

  const runRefineItem = useCallback(
    async (item: ContentScheduleItem, instruction: string) => {
      setRefining(true);
      setAiError(null);
      try {
        const res = await aiQueue.enqueue("Refinar item do cronograma", () =>
          aiFetch("/api/generate-content-schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandGem,
              ...(clientId ? { clientId } : {}),
              mode: "refine_one",
              existingItem: item,
              refineInstruction: instruction,
            }),
          })
        );
        const data = await readJsonResponse<{ items?: ContentScheduleItem[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Falha ao refinar item.");
        const refined = data.items?.[0];
        if (!refined) throw new Error("Item refinado vazio.");
        updateItem(item.id, refined);
        toast.success("Item atualizado.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setAiError(msg);
        toast.error(msg);
      } finally {
        setRefining(false);
      }
    },
    [brandGem, clientId, updateItem]
  );

  const handleRefine = useCallback(async () => {
    if (!selectedItem || !refineInstruction.trim()) return;
    await runRefineItem(selectedItem, refineInstruction);
    setRefineInstruction("");
  }, [refineInstruction, runRefineItem, selectedItem]);

  const handleRegenerateItem = useCallback(async () => {
    if (!selectedItem) return;
    const ok = await confirmDialog({
      title: "Recriar item",
      message: `A IA vai recriar "${selectedItem.name}" do zero.`,
      confirmLabel: "Recriar",
    });
    if (!ok) return;
    await runRefineItem(
      selectedItem,
      "Recrie este item completamente do zero com novo ângulo criativo. Mantenha formato e coerência com o briefing."
    );
  }, [runRefineItem, selectedItem]);

  const handleDeleteItem = useCallback(
    async (item: ContentScheduleItem) => {
      const ok = await confirmDialog({
        title: "Excluir item",
        message: `Remover "${item.name}" do cronograma?`,
        variant: "danger",
        confirmLabel: "Excluir",
      });
      if (!ok) return;
      onItemsChange(items.filter((i) => i.id !== item.id));
      if (selectedId === item.id) setSelectedId(null);
      toast.success("Item removido.");
    },
    [items, onItemsChange, selectedId]
  );

  const handleCreateSingleItem = useCallback(
    async (section: ContentScheduleSection) => {
      if (!brandGemReady) {
        toast.error(brandGemRequiredMessage(brandGem) || "Configure o Gem da marca.");
        return;
      }
      if (!briefDraft.trim()) {
        toast.error("Preencha o briefing do mês antes de criar um item.");
        return;
      }
      const sectionItems = items.filter((i) => i.section === section);
      const nextOrder =
        sectionItems.length > 0 ? Math.max(...sectionItems.map((i) => i.order)) + 1 : 1;

      setCreatingSingle(section);
      setAiError(null);
      try {
        const res = await aiQueue.enqueue(
          section === "posts" ? "Criar post avulso" : "Criar story avulsa",
          () =>
            aiFetch("/api/generate-content-schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brandGem,
                clientBrief: briefDraft,
                ...(clientId ? { clientId } : {}),
                mode: "generate_one",
                section,
                options: {
                  startDate,
                  extraInstructions,
                  itemInstruction: singleItemTheme.trim() || undefined,
                  order: nextOrder,
                  existingItems: sectionItems.map((i) => ({
                    name: i.name,
                    headline: i.headline,
                    scheduledDate: i.scheduledDate,
                  })),
                },
              }),
            })
        );
        const data = await readJsonResponse<{ items?: ContentScheduleItem[]; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Falha ao criar item.");
        const created = data.items?.[0];
        if (!created) throw new Error("A IA não retornou o item.");
        persistBriefAndOptions();
        onItemsChange([...items, created]);
        setSelectedId(created.id);
        setSingleItemTheme("");
        toast.success(section === "posts" ? "Post adicionado." : "Story adicionada.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setAiError(msg);
        toast.error(msg);
      } finally {
        setCreatingSingle(null);
      }
    },
    [
      brandGem,
      brandGemReady,
      briefDraft,
      clientId,
      extraInstructions,
      items,
      onItemsChange,
      persistBriefAndOptions,
      singleItemTheme,
      startDate,
    ]
  );

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
      toast.error("Nenhum item aprovado para enviar.");
      return;
    }
    onPushToPlanning(result.posts, result.items);
    toast.success(
      `${result.pushedCount} item(ns) enviado(s).` +
        (result.skippedCount ? ` ${result.skippedCount} ignorado(s).` : "")
    );
  }, [items, onPushToPlanning, posts, startDate]);

  const handleStrengthenCopy = useCallback(async () => {
    if (!selectedItem) return;
    setStrengthening(true);
    setAiError(null);
    try {
      const res = await aiQueue.enqueue("Reforçar copy", () =>
        aiFetch("/api/generate-content-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandGem,
            ...(clientId ? { clientId } : {}),
            mode: "strengthen_one",
            existingItem: selectedItem,
          }),
        })
      );
      const data = await readJsonResponse<{ items?: ContentScheduleItem[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Falha ao reforçar copy.");
      const refined = data.items?.[0];
      if (!refined) throw new Error("Item vazio.");
      updateItem(selectedItem.id, refined);
      toast.success("Copy reforçada.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(msg);
      toast.error(msg);
    } finally {
      setStrengthening(false);
    }
  }, [brandGem, clientId, selectedItem, updateItem]);

  const scheduleExportOptions = useMemo(
    () => ({ periodLabel, brandName: brandName ?? "Cliente" }),
    [brandName, periodLabel]
  );

  const handleExportTxt = useCallback(() => {
    const text = formatFullSchedule(items, scheduleExportOptions);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cronograma-${periodLabel?.replace(/\s+/g, "-") ?? "conteudo"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, periodLabel, scheduleExportOptions]);

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      await exportContentSchedulePdf({
        items,
        brandName: brandName ?? "Cliente",
        periodLabel: periodLabel ?? "Conteúdo",
        clientSlug: brandName,
      });
      toast.success("PDF exportado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingPdf(false);
    }
  }, [brandName, items, periodLabel]);

  const handleExportDocx = useCallback(async () => {
    setExportingDocx(true);
    try {
      await exportContentScheduleDocx({
        items,
        brandName: brandName ?? "Cliente",
        periodLabel: periodLabel ?? "Conteúdo",
        clientSlug: brandName,
      });
      toast.success("DOCX exportado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingDocx(false);
    }
  }, [brandName, items, periodLabel]);

  const showResultsArea = hasItems || (!isReadOnly && brandGemReady) || generating;
  const showBriefingPanel = briefingPanelOpen || !hasItems || generating;

  const openBriefingPanel = useCallback((scrollIntoView = false) => {
    briefingOpenedManually.current = true;
    setBriefingPanelOpen(true);
    if (scrollIntoView) {
      requestAnimationFrame(() => {
        briefingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const handleWorkflowStepClick = useCallback(
    (stepId: string) => {
      if (stepId === "brief") {
        briefingOpenedManually.current = true;
        setBriefingPanelOpen((open) => {
          const next = !open;
          if (next) {
            requestAnimationFrame(() => {
              briefingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
          return next;
        });
        return;
      }
      if (stepId === "gen") {
        openBriefingPanel(true);
      }
    },
    [openBriefingPanel]
  );

  const editorPanel = selectedItem ? (
    <ScheduleEditorPanel
      item={selectedItem}
      isReadOnly={isReadOnly}
      refining={refining}
      strengthening={strengthening}
      refineInstruction={refineInstruction}
      onRefineInstructionChange={setRefineInstruction}
      onClose={() => setSelectedId(null)}
      onChange={(patch) => updateItem(selectedItem.id, patch)}
      onRefine={() => void handleRefine()}
      onStrengthen={() => void handleStrengthenCopy()}
      onRegenerate={() => void handleRegenerateItem()}
      onDelete={() => void handleDeleteItem(selectedItem)}
      onCopy={() => void copyText(formatScheduleItemCopy(selectedItem), selectedItem.id)}
      onApprove={() => updateItem(selectedItem.id, { status: "approved" })}
    />
  ) : (
    <ScheduleEditorEmpty hasItems={hasItems} />
  );

  return (
    <div className="space-y-5" aria-busy={generating}>
      <WorkspaceHero
        eyebrow="Cronograma"
        sectionTitle="Cronograma de conteúdo"
        titleHint="Salvo na nuvem ao gerar"
        titleHintTooltip="Briefing e opções só são salvos na nuvem ao gerar o cronograma."
        subtitle={
          periodLabel
            ? `Planejamento editorial · ${periodLabel}`
            : "Planejamento editorial com IA para posts e stories"
        }
        icon={Sparkles}
      />

      <WorkflowStepper
        steps={workflowSteps}
        ariaLabel="Progresso do cronograma"
        onStepClick={handleWorkflowStepClick}
      />

      {aiError && <AiErrorBanner message={aiError} onRetry={() => setAiError(null)} />}

      {showBriefingPanel && (
        <div ref={briefingPanelRef} id="schedule-briefing-panel" className="scroll-mt-4">
          <ScheduleBriefingPanel
          briefDraft={briefDraft}
          onBriefDraftChange={setBriefDraft}
          postCount={postCount}
          onPostCountChange={setPostCount}
          storyCount={storyCount}
          onStoryCountChange={setStoryCount}
          startDate={startDate}
          extraInstructions={extraInstructions}
          onExtraInstructionsChange={setExtraInstructions}
          singleItemTheme={singleItemTheme}
          onSingleItemThemeChange={setSingleItemTheme}
          brandGem={brandGem}
          brandGemReady={brandGemReady}
          isReadOnly={isReadOnly}
          generating={generating}
          creatingSingle={creatingSingle}
          hasGeneratedSchedule={hasGeneratedSchedule}
          missingGemLabels={missingGemLabels}
          onGenerate={() => void handleGenerate()}
          onClearSchedule={() => void handleClearSchedule()}
          onCreateSingle={(section) => void handleCreateSingleItem(section)}
          onConfigureGem={onConfigureGem}
        />
        </div>
      )}

      {showResultsArea && (
        <ScheduleSplitLayout
          left={
            <>
              {generating && (
                <ScheduleGeneratingState postCount={postCount} storyCount={storyCount} />
              )}

              {hasItems && !generating && (
                <>
                  <ScheduleProgressSummary
                    total={items.length}
                    draftCount={draftCount}
                    approvedCount={approvedCount}
                    doneCount={doneCount}
                    postsCount={postsItems.length}
                    storiesCount={storiesItems.length}
                  />
                  <ScheduleBulkActions
                    isReadOnly={isReadOnly}
                    approvedCount={approvedCount}
                    exportingPdf={exportingPdf}
                    exportingDocx={exportingDocx}
                    onClearSchedule={() => void handleClearSchedule()}
                    onCopyAll={() => void copyText(formatFullSchedule(items, scheduleExportOptions))}
                    onExportTxt={handleExportTxt}
                    onExportPdf={() => void handleExportPdf()}
                    onExportDocx={() => void handleExportDocx()}
                    onPushToPlanning={handlePushToPlanning}
                  />
                </>
              )}

              {generating ? (
                <ScheduleBoardSkeleton />
              ) : (
                <ScheduleBoard
                  postsItems={postsItems}
                  storiesItems={storiesItems}
                  selectedId={selectedId}
                  copiedId={copiedId}
                  isReadOnly={isReadOnly}
                  brandGemReady={brandGemReady}
                  creatingSingle={creatingSingle}
                  hasBrief={hasBrief}
                  onSelect={setSelectedId}
                  onCreateSingle={(section) => void handleCreateSingleItem(section)}
                  onCopy={(item) => void copyText(formatScheduleItemCopy(item), item.id)}
                  onApprove={(id) => updateItem(id, { status: "approved" })}
                  onMarkDone={(id) => updateItem(id, { status: "done" })}
                  onDelete={(item) => void handleDeleteItem(item)}
                />
              )}
            </>
          }
          right={editorPanel}
        />
      )}
    </div>
  );
}

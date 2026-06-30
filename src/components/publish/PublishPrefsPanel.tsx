"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Save, Share2, Zap } from "lucide-react";
import { DEFAULT_SLOT_TEMPLATES } from "../../lib/publish/suggestScheduleTimes";
import {
  PUBLISH_PLATFORMS_V1,
  PLATFORM_LABELS,
  type PublishPlatform,
} from "../../lib/publish/platforms";
import {
  fetchPublishPrefs,
  savePublishPrefs,
  type PublishPrefs,
  type SocialConnectionPublic,
} from "../../lib/publish/publishApi";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { Button } from "../ui/Button";
import { FieldLabel } from "../ui/Input";
import { SocialConnectionsPanel } from "./SocialConnectionsPanel";

const SLOT_COUNTS = [1, 2, 3, 4, 5] as const;

export function PublishPrefsPanel({
  clientId,
  connections,
  onConnectionRefresh,
  onPrefsChange,
  hideConnection,
  publishMockEnabled,
}: {
  clientId: string;
  connections: SocialConnectionPublic[];
  onConnectionRefresh: () => void;
  onPrefsChange?: (prefs: PublishPrefs) => void;
  hideConnection?: boolean;
  publishMockEnabled?: boolean;
}) {
  const [draft, setDraft] = useState<PublishPrefs>({
    timezone: "America/Sao_Paulo",
    slotTemplates: { ...DEFAULT_SLOT_TEMPLATES },
    defaultLeadMinutes: 15,
    autoScheduleOnDrop: false,
    defaultPlatforms: ["instagram"],
    pinterestDefaultBoardId: null,
  });
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    void fetchPublishPrefs(clientId).then((prefs) => {
      setDraft(prefs);
      setBaseline(JSON.stringify(prefs));
      onPrefsChange?.(prefs);
    });
  }, [clientId, onPrefsChange]);

  const isDirty = JSON.stringify(draft) !== baseline;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await savePublishPrefs(clientId, draft);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      onPrefsChange?.(saved);
      setJustSaved(true);
      toast.success("Preferências salvas.");
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }, [clientId, draft, onPrefsChange]);

  const updateSlot = (count: number, index: number, value: string) => {
    setDraft((prev) => {
      const key = String(count);
      const slots = [...(prev.slotTemplates[key] ?? DEFAULT_SLOT_TEMPLATES[key] ?? ["10:00"])];
      slots[index] = value;
      return {
        ...prev,
        slotTemplates: { ...prev.slotTemplates, [key]: slots },
      };
    });
  };

  const togglePlatform = (platform: PublishPlatform) => {
    setDraft((prev) => {
      const set = new Set(prev.defaultPlatforms);
      if (set.has(platform)) {
        if (set.size <= 1) return prev;
        set.delete(platform);
      } else {
        set.add(platform);
      }
      return { ...prev, defaultPlatforms: PUBLISH_PLATFORMS_V1.filter((p) => set.has(p)) };
    });
  };

  const pinterestConn = connections.find((c) => c.platform === "pinterest");
  const pinterestBoards =
    (pinterestConn?.metadata.boards as Array<{ id: string; name: string }> | undefined) ?? [];

  return (
    <div className="space-y-6">
      {!hideConnection && (
        <SocialConnectionsPanel
          clientId={clientId}
          connections={connections}
          onRefresh={onConnectionRefresh}
          publishMockEnabled={publishMockEnabled}
        />
      )}

      <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ag-text flex items-center gap-2">
            <Share2 className="h-5 w-5 text-ag-accent" />
            Redes padrão ao agendar
          </h3>
          <p className="text-sm text-ag-muted mt-1">
            Posts novos serão programados nestas redes. Você pode ajustar por post no composer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PUBLISH_PLATFORMS_V1.map((platform) => {
            const selected = draft.defaultPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                  selected
                    ? "border-ag-accent bg-ag-accent/15 text-ag-accent"
                    : "border-ag-border text-ag-muted hover:border-ag-accent/40"
                )}
              >
                {PLATFORM_LABELS[platform]}
              </button>
            );
          })}
        </div>

        {draft.defaultPlatforms.includes("pinterest") && pinterestBoards.length > 0 && (
          <div className="max-w-md">
            <FieldLabel htmlFor="pinterest-board">Board padrão (Pinterest)</FieldLabel>
            <select
              id="pinterest-board"
              value={draft.pinterestDefaultBoardId ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  pinterestDefaultBoardId: e.target.value || null,
                }))
              }
              className="w-full rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm ag-focus-ring"
            >
              <option value="">Selecione um board…</option>
              {pinterestBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 space-y-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-ag-text flex items-center gap-2">
            <Zap className="h-5 w-5 text-ag-accent" />
            Comportamento ao arrastar
          </h3>
          <p className="text-sm text-ag-muted mt-1">
            Escolha se arrastar um post para o calendário cria um rascunho ou agenda imediatamente.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-ag-border bg-ag-surface-1 p-4">
          <input
            type="checkbox"
            checked={draft.autoScheduleOnDrop}
            onChange={(e) => setDraft((p) => ({ ...p, autoScheduleOnDrop: e.target.checked }))}
            className="mt-0.5 accent-ag-accent"
          />
          <span>
            <span className="text-sm font-semibold text-ag-text block">Agendar ao soltar</span>
            <span className="text-xs text-ag-muted">
              Quando desligado (padrão), arrastar cria um rascunho — confirme depois com o botão
              &quot;Confirmar agendamento&quot;.
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 space-y-5">
        <div>
          <h3 className="font-display text-lg font-semibold text-ag-text flex items-center gap-2">
            <Clock className="h-5 w-5 text-ag-accent" />
            Horários rápidos
          </h3>
          <p className="text-sm text-ag-muted mt-1">
            Usamos estes horários só para sugerir. Você pode mudar cada post depois na fila.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLOT_COUNTS.map((count) => {
            const slots =
              draft.slotTemplates[String(count)] ?? DEFAULT_SLOT_TEMPLATES[String(count)] ?? ["10:00"];
            return (
              <div
                key={count}
                className="rounded-xl border border-ag-border bg-ag-surface-1 p-4 space-y-3"
              >
                <p className="text-sm font-semibold text-ag-text">
                  {count} {count === 1 ? "post" : "posts"} por dia
                </p>
                {slots.map((time, idx) => (
                  <div key={idx}>
                    <FieldLabel htmlFor={`slot-${count}-${idx}`}>Horário {idx + 1}</FieldLabel>
                    <input
                      id={`slot-${count}-${idx}`}
                      type="time"
                      value={time}
                      onChange={(e) => updateSlot(count, idx, e.target.value)}
                      className="w-full rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm ag-focus-ring"
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="max-w-xs">
          <FieldLabel htmlFor="publish-lead">Antecedência mínima (minutos)</FieldLabel>
          <input
            id="publish-lead"
            type="number"
            min={0}
            max={120}
            value={draft.defaultLeadMinutes}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                defaultLeadMinutes: Number.parseInt(e.target.value, 10) || 0,
              }))
            }
            className="w-full rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm ag-focus-ring"
          />
        </div>

        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4",
            isDirty ? "border-ag-warning/30 bg-ag-warning/5" : "border-ag-border bg-ag-surface-2/60"
          )}
        >
          <p className="text-sm text-ag-muted">
            {isDirty ? (
              <span className="text-ag-warning font-medium">Alterações não salvas</span>
            ) : justSaved ? (
              <span className="text-ag-success font-medium inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Salvo
              </span>
            ) : (
              "Fuso: Horário de Brasília (padrão)"
            )}
          </p>
          <Button
            type="button"
            variant="accent"
            size="md"
            disabled={!isDirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Save className="h-4 w-4 animate-pulse" /> Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Salvar preferências
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

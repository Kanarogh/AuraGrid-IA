"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Cloud, Save } from "lucide-react";
import { AccentPicker } from "./AccentPicker";
import { Button } from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import {
  ACCENT_CHANGE_EVENT,
  CUSTOM_ACCENT_CHANGE_EVENT,
} from "../../hooks/useAccent";
import { THEME_CHANGE_EVENT } from "../../hooks/useTheme";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import {
  APPEARANCE_BASELINE_EVENT,
  appearanceSnapshotSignature,
  dispatchAppearanceBaseline,
  readLocalAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSnapshot,
} from "../../lib/appearanceSettings";

function formatSavedLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function AppearanceSettingsPanel() {
  const { user, storageMode } = useAuth();
  const cloudAccount = storageMode === "postgresql" && !!user;

  const [baseline, setBaseline] = useState<AppearanceSnapshot>(() => readLocalAppearanceSettings());
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const current = readLocalAppearanceSettings();
  const isDirty =
    appearanceSnapshotSignature(current) !== appearanceSnapshotSignature(baseline);

  useEffect(() => {
    const bump = () => setRevision((n) => n + 1);
    window.addEventListener(ACCENT_CHANGE_EVENT, bump);
    window.addEventListener(CUSTOM_ACCENT_CHANGE_EVENT, bump);
    window.addEventListener(THEME_CHANGE_EVENT, bump);
    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, bump);
      window.removeEventListener(THEME_CHANGE_EVENT, bump);
      window.removeEventListener(CUSTOM_ACCENT_CHANGE_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    const onBaseline = (e: Event) => {
      const next = (e as CustomEvent<AppearanceSnapshot>).detail;
      if (!next) return;
      setBaseline(next);
      setJustSaved(false);
    };
    window.addEventListener(APPEARANCE_BASELINE_EVENT, onBaseline);
    return () => window.removeEventListener(APPEARANCE_BASELINE_EVENT, onBaseline);
  }, []);

  void revision;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const snapshot = readLocalAppearanceSettings();
      if (cloudAccount) {
        const saved = await saveAppearanceSettings(snapshot);
        setSavedAt(saved.updatedAt);
        dispatchAppearanceBaseline(snapshot);
        toast.success("Aparência salva na sua conta.");
      } else {
        setSavedAt(new Date().toISOString());
        dispatchAppearanceBaseline(snapshot);
        toast.success("Aparência salva neste dispositivo.");
      }
      setBaseline(snapshot);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar a aparência."
      );
    } finally {
      setSaving(false);
    }
  }, [cloudAccount]);

  const savedLabel = formatSavedLabel(savedAt);

  return (
    <div className="space-y-4">
      <AccentPicker />

      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4",
          isDirty
            ? "border-ag-warning/30 bg-ag-warning/5"
            : justSaved
              ? "border-ag-success/30 bg-ag-success/5"
              : "border-ag-border bg-ag-surface-2/60"
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ag-text inline-flex items-center gap-1.5">
            {cloudAccount && <Cloud className="h-3.5 w-3.5 text-ag-muted shrink-0" />}
            Cor de destaque do workspace
          </p>
          <p className="text-xs mt-1.5 text-ag-muted leading-relaxed">
            {cloudAccount
              ? "A prévia muda na hora. Clique em Salvar para sincronizar com sua conta e usar em outros dispositivos."
              : "A prévia muda na hora. Clique em Salvar para confirmar neste navegador."}
          </p>
          <p className="text-xs mt-1.5">
            {isDirty ? (
              <span className="text-ag-warning font-medium">Alterações não salvas</span>
            ) : justSaved ? (
              <span className="text-ag-success font-medium inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                {cloudAccount ? "Aparência salva na nuvem" : "Aparência salva neste dispositivo"}
              </span>
            ) : savedLabel ? (
              <span className="text-ag-muted">
                Último salvamento: <strong className="text-ag-text">{savedLabel}</strong>
              </span>
            ) : (
              <span className="text-ag-muted">Escolha uma cor e clique em Salvar.</span>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="accent"
          size="md"
          onClick={() => void handleSave()}
          disabled={!isDirty || saving}
          className="shrink-0 w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Save className="h-4 w-4 animate-pulse" />
              Salvando…
            </>
          ) : justSaved ? (
            <>
              <Check className="h-4 w-4" />
              Salvo
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar aparência
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

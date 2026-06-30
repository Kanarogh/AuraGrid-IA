"use client";

import { Check, Pipette } from "lucide-react";
import type { CustomAccentConfig } from "../../lib/accentColor";
import { useAccent } from "../../hooks/useAccent";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/cn";
import { FieldLabel } from "../ui/Input";

const CUSTOM_SWATCH =
  "conic-gradient(from 180deg, #ff6b6b, #fbbf24, #34d399, #3d5af1, #a78bfa, #ff6b6b)";

const AURA_GRADIENT = "var(--ag-gradient-brand)";

function presetSwatchStyle(presetId: string, color: string, active: boolean) {
  if (presetId === "aura") {
    return {
      background: AURA_GRADIENT,
      boxShadow: active ? "0 0 0 2px var(--ag-brand-purple)" : undefined,
    } as const;
  }
  return {
    backgroundColor: color,
    boxShadow: active ? `0 0 0 2px ${color}` : undefined,
  } as const;
}

function CustomAccentFields({
  customColors,
  setCustomColors,
  compact,
  className,
}: {
  customColors: CustomAccentConfig;
  setCustomColors: (partial: Partial<CustomAccentConfig>) => void;
  compact?: boolean;
  className?: string;
}) {

  return (
    <div
      className={cn(
        "rounded-xl border border-ag-border bg-ag-surface-2/80 p-3 space-y-3",
        className
      )}
    >
      <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
        Paleta personalizada
      </p>
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        <div>
          <FieldLabel htmlFor="accent-custom-light">Modo claro</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              id="accent-custom-light"
              type="color"
              value={customColors.light}
              onChange={(e) => setCustomColors({ light: e.target.value })}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-ag-border bg-ag-surface-1 p-1 ag-focus-ring"
              aria-label="Cor de destaque no modo claro"
            />
            <span className="text-xs font-mono text-ag-muted">{customColors.light}</span>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="accent-custom-dark">Modo escuro</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              id="accent-custom-dark"
              type="color"
              value={customColors.dark}
              onChange={(e) => setCustomColors({ dark: e.target.value })}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-ag-border bg-ag-surface-1 p-1 ag-focus-ring"
              aria-label="Cor de destaque no modo escuro"
            />
            <span className="text-xs font-mono text-ag-muted">{customColors.dark}</span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ag-muted leading-relaxed">
        Variações de hover e fundo são geradas automaticamente a partir da cor escolhida.
      </p>
    </div>
  );
}

export function AccentPicker({
  variant = "grid",
  className,
  showCustomEditor = true,
}: {
  variant?: "grid" | "row";
  className?: string;
  /** Show color inputs when "Personalizado" is active (grid always; row when true). */
  showCustomEditor?: boolean;
}) {
  const { accent, setAccent, presets, customColors, setCustomColors } = useAccent();
  const { isDark } = useTheme();
  const customActive = accent === "custom";
  const customPreview = isDark ? customColors.dark : customColors.light;

  if (variant === "row") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => {
            const color = isDark ? preset.swatchDark : preset.swatch;
            const active = accent === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAccent(preset.id)}
                title={preset.label}
                aria-label={`Acento ${preset.label}`}
                aria-pressed={active}
                className={cn(
                  "h-6 w-6 rounded-full ag-focus-ring transition-transform duration-150 cursor-pointer",
                  active ? "scale-110 ring-2 ring-offset-2 ring-offset-ag-surface-1" : "hover:scale-110"
                )}
                style={presetSwatchStyle(preset.id, color, active)}
              />
            );
          })}
          <button
            type="button"
            onClick={() => setAccent("custom")}
            title="Personalizado"
            aria-label="Acento personalizado"
            aria-pressed={customActive}
            className={cn(
              "h-6 w-6 rounded-full ag-focus-ring transition-transform duration-150 cursor-pointer border border-ag-border",
              customActive ? "scale-110 ring-2 ring-offset-2 ring-offset-ag-surface-1" : "hover:scale-110"
            )}
            style={{
              background: customActive ? customPreview : CUSTOM_SWATCH,
              boxShadow: customActive ? `0 0 0 2px ${customPreview}` : undefined,
            }}
          />
        </div>
        {showCustomEditor && customActive && (
          <CustomAccentFields
            customColors={customColors}
            setCustomColors={setCustomColors}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {presets.map((preset) => {
          const color = isDark ? preset.swatchDark : preset.swatch;
          const active = accent === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAccent(preset.id)}
              aria-pressed={active}
              className={cn(
                "group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ag-focus-ring",
                active
                  ? "border-ag-accent bg-ag-accent-soft"
                  : "border-ag-border bg-ag-surface-2 hover:border-ag-accent/50 hover:bg-ag-surface-3"
              )}
            >
              <span
                className="relative flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
                style={
                  preset.id === "aura"
                    ? { background: AURA_GRADIENT }
                    : { backgroundColor: color }
                }
              >
                {active && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  active ? "text-ag-accent" : "text-ag-muted group-hover:text-ag-text"
                )}
              >
                {preset.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setAccent("custom")}
          aria-pressed={customActive}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer ag-focus-ring sm:col-span-2 lg:col-span-1",
            customActive
              ? "border-ag-accent bg-ag-accent-soft"
              : "border-ag-border bg-ag-surface-2 hover:border-ag-accent/50 hover:bg-ag-surface-3"
          )}
        >
          <span
            className="relative flex h-9 w-9 items-center justify-center rounded-full shadow-sm overflow-hidden"
            style={{ background: customActive ? customPreview : CUSTOM_SWATCH }}
          >
            {customActive ? (
              <Check className="h-4 w-4 text-white drop-shadow-sm" strokeWidth={3} />
            ) : (
              <Pipette className="h-4 w-4 text-white drop-shadow-sm" />
            )}
          </span>
          <span
            className={cn(
              "text-[11px] font-semibold",
              customActive ? "text-ag-accent" : "text-ag-muted group-hover:text-ag-text"
            )}
          >
            Personalizado
          </span>
        </button>
      </div>

      {showCustomEditor && customActive && (
        <CustomAccentFields customColors={customColors} setCustomColors={setCustomColors} />
      )}
    </div>
  );
}

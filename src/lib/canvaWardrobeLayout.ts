import type { CSSProperties } from "react";

export const WARDROBE_PANEL_STORAGE_KEY = "ag_wardrobe_panel_pct";
export const PANEL_PCT_MIN = 34;
export const PANEL_PCT_MAX = 58;
export const PANEL_PCT_DEFAULT = 50;
export const PANEL_PCT_STEP = 2;
export const PANEL_MIN_PX = 380;
export const PANEL_MAX_PX = 760;

export function readStoredPanelPct(): number {
  if (typeof window === "undefined") return PANEL_PCT_DEFAULT;
  const raw = localStorage.getItem(WARDROBE_PANEL_STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return PANEL_PCT_DEFAULT;
  return clampPanelPct(n);
}

export function clampPanelPct(value: number): number {
  return Math.min(PANEL_PCT_MAX, Math.max(PANEL_PCT_MIN, value));
}

export function persistPanelPct(value: number): number {
  const next = clampPanelPct(value);
  localStorage.setItem(WARDROBE_PANEL_STORAGE_KEY, String(next));
  return next;
}

export function wardrobePanelStyleFromPct(panelWidthPct: number): CSSProperties {
  return {
    width: `${panelWidthPct}%`,
    minWidth: PANEL_MIN_PX,
    maxWidth: PANEL_MAX_PX,
    flexShrink: 0,
  };
}

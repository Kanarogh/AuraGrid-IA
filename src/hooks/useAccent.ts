"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type CustomAccentConfig,
  clearAccentTokensFromElement,
  getCustomAccentForTheme,
  readStoredCustomAccent,
  writeStoredCustomAccent,
  applyAccentTokensToElement,
} from "../lib/accentColor";
import { THEME_CHANGE_EVENT, type Theme } from "./useTheme";

export type FixedAccentId =
  | "cobalto"
  | "esmeralda"
  | "argila"
  | "rose"
  | "vermelho"
  | "violeta"
  | "grafite";

export type AccentId = FixedAccentId | "custom";

export type AccentPreset = {
  id: FixedAccentId;
  label: string;
  swatch: string;
  swatchDark: string;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "cobalto", label: "Cobalto", swatch: "#3d5af1", swatchDark: "#7c8cff" },
  { id: "esmeralda", label: "Esmeralda", swatch: "#0e8c70", swatchDark: "#34d6ad" },
  { id: "argila", label: "Argila", swatch: "#b4632f", swatchDark: "#e08a52" },
  { id: "rose", label: "Rosé", swatch: "#b83d6b", swatchDark: "#f178a4" },
  { id: "vermelho", label: "Vermelho", swatch: "#c62828", swatchDark: "#ff6b6b" },
  { id: "violeta", label: "Violeta", swatch: "#5c5ce0", swatchDark: "#8b8bf5" },
  { id: "grafite", label: "Grafite", swatch: "#3a3a42", swatchDark: "#c7c7d1" },
];

const STORAGE_KEY = "ag_accent";
const ACCENT_CHANGE_EVENT = "ag-accent-change";
const CUSTOM_CHANGE_EVENT = "ag-accent-custom-change";
const DEFAULT_ACCENT: AccentId = "cobalto";

export function isAccentId(value: unknown): value is AccentId {
  return value === "custom" || ACCENT_PRESETS.some((p) => p.id === value);
}

function readStoredAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isAccentId(stored) ? stored : DEFAULT_ACCENT;
}

function getActiveTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyAccentToDom(accent: AccentId) {
  const root = document.documentElement;
  root.setAttribute("data-accent", accent);

  if (accent === "custom") {
    const stored = readStoredCustomAccent();
    applyAccentTokensToElement(root, getCustomAccentForTheme(stored, getActiveTheme()));
  } else {
    clearAccentTokensFromElement(root);
  }
}

function broadcastAccentChange(accent: AccentId) {
  // Defer so listeners in sibling components don't setState during another render.
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent<AccentId>(ACCENT_CHANGE_EVENT, { detail: accent }));
  });
}

function applyAccent(accent: AccentId, broadcast = true) {
  localStorage.setItem(STORAGE_KEY, accent);
  applyAccentToDom(accent);
  if (broadcast) broadcastAccentChange(accent);
}

/** Apply accent before first paint to avoid flash. */
export function initAccent() {
  applyAccent(readStoredAccent(), false);
}

export function useAccent() {
  const [accent, setAccentState] = useState<AccentId>(readStoredAccent);
  const [customColors, setCustomColorsState] = useState<CustomAccentConfig>(() => {
    const stored = readStoredCustomAccent();
    return { light: stored.light, dark: stored.dark };
  });

  useEffect(() => {
    const onAccentChange = (e: Event) => {
      const next = (e as CustomEvent<AccentId>).detail;
      if (isAccentId(next)) setAccentState(next);
    };
    const onCustomChange = () => {
      const stored = readStoredCustomAccent();
      setCustomColorsState({ light: stored.light, dark: stored.dark });
      if (readStoredAccent() === "custom") applyAccentToDom("custom");
    };
    const onThemeChange = () => {
      if (readStoredAccent() === "custom") applyAccentToDom("custom");
    };

    window.addEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
    window.addEventListener(CUSTOM_CHANGE_EVENT, onCustomChange);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
      window.removeEventListener(CUSTOM_CHANGE_EVENT, onCustomChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    };
  }, []);

  const setAccent = useCallback((next: AccentId) => {
    applyAccent(next);
    setAccentState(next);
  }, []);

  const setCustomColors = useCallback((partial: Partial<CustomAccentConfig>) => {
    setCustomColorsState((prev) => {
      const next: CustomAccentConfig = {
        light: partial.light ?? prev.light,
        dark: partial.dark ?? prev.dark,
      };
      writeStoredCustomAccent(next);
      return next;
    });

    localStorage.setItem(STORAGE_KEY, "custom");
    applyAccentToDom("custom");
    setAccentState("custom");

    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent<AccentId>(ACCENT_CHANGE_EVENT, { detail: "custom" }));
      window.dispatchEvent(new CustomEvent(CUSTOM_CHANGE_EVENT));
    });
  }, []);

  return {
    accent,
    setAccent,
    presets: ACCENT_PRESETS,
    customColors,
    setCustomColors,
    isCustom: accent === "custom",
  };
}

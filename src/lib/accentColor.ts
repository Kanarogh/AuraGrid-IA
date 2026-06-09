export type AccentTokens = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentFg: string;
};

export type CustomAccentConfig = {
  light: string;
  dark: string;
};

export const DEFAULT_CUSTOM_ACCENT: CustomAccentConfig = {
  light: "#3d5af1",
  dark: "#7c8cff",
};

export const CUSTOM_ACCENT_STORAGE_KEY = "ag_accent_custom";

export function normalizeHex(hex: string): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }
  return DEFAULT_CUSTOM_ACCENT.light;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  );
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rs = channel(r);
  const gs = channel(g);
  const bs = channel(b);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastForeground(bgHex: string): string {
  return luminance(bgHex) > 0.55 ? "#15151a" : "#ffffff";
}

/** Derive strong / soft / fg from a single base accent for light or dark UI. */
export function deriveAccentTokens(baseHex: string, mode: "light" | "dark"): AccentTokens {
  const accent = normalizeHex(baseHex);
  const accentStrong =
    mode === "light" ? mix(accent, "#000000", 0.2) : mix(accent, "#ffffff", 0.25);
  const accentSoft =
    mode === "light" ? mix(accent, "#ffffff", 0.9) : mix(accent, "#000000", 0.84);
  const accentFg = contrastForeground(accent);
  return { accent, accentStrong, accentSoft, accentFg };
}

export function applyAccentTokensToElement(el: HTMLElement, tokens: AccentTokens): void {
  el.style.setProperty("--ag-accent", tokens.accent);
  el.style.setProperty("--ag-accent-strong", tokens.accentStrong);
  el.style.setProperty("--ag-accent-soft", tokens.accentSoft);
  el.style.setProperty("--ag-accent-fg", tokens.accentFg);
}

export function clearAccentTokensFromElement(el: HTMLElement): void {
  el.style.removeProperty("--ag-accent");
  el.style.removeProperty("--ag-accent-strong");
  el.style.removeProperty("--ag-accent-soft");
  el.style.removeProperty("--ag-accent-fg");
}

export type StoredCustomAccent = CustomAccentConfig & {
  tokensLight: AccentTokens;
  tokensDark: AccentTokens;
};

export function buildStoredCustomAccent(config: CustomAccentConfig): StoredCustomAccent {
  const light = normalizeHex(config.light);
  const dark = normalizeHex(config.dark);
  return {
    light,
    dark,
    tokensLight: deriveAccentTokens(light, "light"),
    tokensDark: deriveAccentTokens(dark, "dark"),
  };
}

export function readStoredCustomAccent(): StoredCustomAccent {
  if (typeof window === "undefined") {
    return buildStoredCustomAccent(DEFAULT_CUSTOM_ACCENT);
  }
  try {
    const raw = localStorage.getItem(CUSTOM_ACCENT_STORAGE_KEY);
    if (!raw) return buildStoredCustomAccent(DEFAULT_CUSTOM_ACCENT);
    const parsed = JSON.parse(raw) as Partial<StoredCustomAccent>;
    if (parsed.tokensLight && parsed.tokensDark && parsed.light && parsed.dark) {
      return {
        light: normalizeHex(parsed.light),
        dark: normalizeHex(parsed.dark),
        tokensLight: parsed.tokensLight,
        tokensDark: parsed.tokensDark,
      };
    }
    if (parsed.light && parsed.dark) {
      return buildStoredCustomAccent({
        light: parsed.light,
        dark: parsed.dark,
      });
    }
  } catch {
    /* ignore */
  }
  return buildStoredCustomAccent(DEFAULT_CUSTOM_ACCENT);
}

export function writeStoredCustomAccent(config: CustomAccentConfig): StoredCustomAccent {
  const stored = buildStoredCustomAccent(config);
  localStorage.setItem(CUSTOM_ACCENT_STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function getCustomAccentForTheme(
  stored: StoredCustomAccent,
  mode: "light" | "dark"
): AccentTokens {
  return mode === "dark" ? stored.tokensDark : stored.tokensLight;
}

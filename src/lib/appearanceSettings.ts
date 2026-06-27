import { apiFetch, readApiJson } from "./api/apiClient";
import { readStoredCustomAccent } from "./accentColor";
import { readStoredAccent, type AccentId } from "../hooks/useAccent";
import { readStoredTheme, type Theme } from "../hooks/useTheme";

export type AppearanceSettings = {
  accentId: AccentId;
  theme: Theme;
  customAccentLight: string | null;
  customAccentDark: string | null;
  saved: boolean;
  updatedAt: string | null;
};

/** Cor de destaque — o modo claro/escuro é controlado na barra superior. */
export type AppearanceAccentSnapshot = {
  accentId: AccentId;
  customAccentLight: string | null;
  customAccentDark: string | null;
};

/** @deprecated Use AppearanceAccentSnapshot para dirty/save de cor. */
export type AppearanceSnapshot = AppearanceAccentSnapshot;

export function appearanceAccentSignature(snapshot: AppearanceAccentSnapshot): string {
  return `${snapshot.accentId}|${snapshot.customAccentLight ?? ""}|${snapshot.customAccentDark ?? ""}`;
}

/** @deprecated Use appearanceAccentSignature */
export function appearanceSnapshotSignature(snapshot: AppearanceAccentSnapshot): string {
  return appearanceAccentSignature(snapshot);
}

export const APPEARANCE_BASELINE_EVENT = "ag-appearance-baseline";

export function dispatchAppearanceBaseline(snapshot: AppearanceAccentSnapshot): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppearanceAccentSnapshot>(APPEARANCE_BASELINE_EVENT, { detail: snapshot })
  );
}

export function readLocalAccentSettings(): AppearanceAccentSnapshot {
  const custom = readStoredCustomAccent();
  return {
    accentId: readStoredAccent(),
    customAccentLight: custom.light,
    customAccentDark: custom.dark,
  };
}

export function readLocalAppearanceSettings(): Omit<
  AppearanceSettings,
  "saved" | "updatedAt"
> {
  return {
    ...readLocalAccentSettings(),
    theme: readStoredTheme(),
  };
}

export async function fetchAppearanceSettings(): Promise<AppearanceSettings> {
  const res = await apiFetch("/api/v1/user/appearance");
  return readApiJson(res);
}

export async function saveAppearanceSettings(
  patch: AppearanceAccentSnapshot
): Promise<AppearanceSettings> {
  const res = await apiFetch("/api/v1/user/appearance", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return readApiJson(res);
}

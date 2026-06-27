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

export type AppearanceSnapshot = Omit<AppearanceSettings, "saved" | "updatedAt">;

export function appearanceSnapshotSignature(snapshot: AppearanceSnapshot): string {
  return `${snapshot.accentId}|${snapshot.theme}|${snapshot.customAccentLight ?? ""}|${snapshot.customAccentDark ?? ""}`;
}

export const APPEARANCE_BASELINE_EVENT = "ag-appearance-baseline";

export function dispatchAppearanceBaseline(snapshot: AppearanceSnapshot): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppearanceSnapshot>(APPEARANCE_BASELINE_EVENT, { detail: snapshot })
  );
}

export function readLocalAppearanceSettings(): Omit<
  AppearanceSettings,
  "saved" | "updatedAt"
> {
  const custom = readStoredCustomAccent();
  return {
    accentId: readStoredAccent(),
    theme: readStoredTheme(),
    customAccentLight: custom.light,
    customAccentDark: custom.dark,
  };
}

export async function fetchAppearanceSettings(): Promise<AppearanceSettings> {
  const res = await apiFetch("/api/v1/user/appearance");
  return readApiJson(res);
}

export async function saveAppearanceSettings(
  patch: Omit<AppearanceSettings, "saved" | "updatedAt">
): Promise<AppearanceSettings> {
  const res = await apiFetch("/api/v1/user/appearance", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return readApiJson(res);
}

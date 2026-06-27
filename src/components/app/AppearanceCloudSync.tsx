"use client";

import { useEffect, useRef } from "react";
import { writeStoredCustomAccent, readStoredCustomAccent } from "../../lib/accentColor";
import {
  fetchAppearanceSettings,
  readLocalAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
} from "../../lib/appearanceSettings";
import { useAuth } from "../../context/AuthContext";
import {
  ACCENT_CHANGE_EVENT,
  CUSTOM_ACCENT_CHANGE_EVENT,
  applyAccent,
} from "../../hooks/useAccent";
import { THEME_CHANGE_EVENT, applyTheme } from "../../hooks/useTheme";

function applyRemoteAppearance(settings: Omit<AppearanceSettings, "saved" | "updatedAt">) {
  applyTheme(settings.theme, true);
  if (settings.accentId === "custom") {
    const fallback = readStoredCustomAccent();
    writeStoredCustomAccent({
      light: settings.customAccentLight ?? fallback.light,
      dark: settings.customAccentDark ?? fallback.dark,
    });
  }
  applyAccent(settings.accentId, true);
}

/** Sincroniza aparência (tema + acento) com a conta na nuvem. */
export function AppearanceCloudSync() {
  const { user, loading, storageMode } = useAuth();
  const applyingRemoteRef = useRef(false);
  const readyToPushRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || storageMode !== "postgresql" || !user) {
      syncedUserIdRef.current = null;
      readyToPushRef.current = false;
      return;
    }

    if (syncedUserIdRef.current === user.id) return;

    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchAppearanceSettings();
        if (cancelled) return;

        applyingRemoteRef.current = true;
        if (remote.saved) {
          applyRemoteAppearance(remote);
        } else {
          const local = readLocalAppearanceSettings();
          await saveAppearanceSettings(local);
        }
        applyingRemoteRef.current = false;
        syncedUserIdRef.current = user.id;
        readyToPushRef.current = true;
      } catch {
        applyingRemoteRef.current = false;
        readyToPushRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, storageMode, user]);

  useEffect(() => {
    if (storageMode !== "postgresql" || !user) return;

    const schedulePush = () => {
      if (!readyToPushRef.current || applyingRemoteRef.current) return;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        if (applyingRemoteRef.current) return;
        const local = readLocalAppearanceSettings();
        void saveAppearanceSettings(local).catch(() => {
          /* silencioso — localStorage já reflete a escolha */
        });
      }, 400);
    };

    const onAccentChange = () => schedulePush();
    const onCustomChange = () => schedulePush();
    const onThemeChange = () => schedulePush();

    window.addEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
    window.addEventListener(CUSTOM_ACCENT_CHANGE_EVENT, onCustomChange);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

    return () => {
      window.removeEventListener(ACCENT_CHANGE_EVENT, onAccentChange);
      window.removeEventListener(CUSTOM_ACCENT_CHANGE_EVENT, onCustomChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [storageMode, user]);

  return null;
}

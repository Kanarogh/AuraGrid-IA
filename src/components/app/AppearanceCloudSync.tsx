"use client";

import { useEffect, useRef } from "react";
import { writeStoredCustomAccent, readStoredCustomAccent } from "../../lib/accentColor";
import {
  fetchAppearanceSettings,
  readLocalAccentSettings,
  saveAppearanceSettings,
  dispatchAppearanceBaseline,
  type AppearanceAccentSnapshot,
} from "../../lib/appearanceSettings";
import { useAuth } from "../../context/AuthContext";
import { applyAccent } from "../../hooks/useAccent";

function applyRemoteAccent(settings: AppearanceAccentSnapshot) {
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
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || storageMode !== "postgresql" || !user) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === user.id) return;

    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchAppearanceSettings();
        if (cancelled) return;

        if (remote.saved) {
          applyRemoteAccent(remote);
          dispatchAppearanceBaseline({
            accentId: remote.accentId,
            customAccentLight: remote.customAccentLight,
            customAccentDark: remote.customAccentDark,
          });
        } else {
          const local = readLocalAccentSettings();
          await saveAppearanceSettings(local);
          dispatchAppearanceBaseline(local);
        }
        syncedUserIdRef.current = user.id;
      } catch {
        /* mantém local até próximo login */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, storageMode, user]);

  return null;
}

import type { SyncDomain, SyncRevisionTokens } from "./types";

export type PeriodTokenChange = {
  prevToken: string;
  nextToken: string;
};

export type DiffSyncRevisionResult = {
  changed: SyncDomain[];
  periodTokenChange?: PeriodTokenChange;
};

export function diffSyncRevisionTokens(
  prev: SyncRevisionTokens | null,
  next: SyncRevisionTokens,
  isPaused: (domain: SyncDomain) => boolean
): DiffSyncRevisionResult {
  if (!prev) {
    return { changed: [] };
  }

  const changed: SyncDomain[] = [];
  let periodTokenChange: PeriodTokenChange | undefined;

  if (next.catalog !== prev.catalog && !isPaused("catalog")) {
    changed.push("catalog");
  }
  if (next.workspace !== prev.workspace && !isPaused("workspace")) {
    changed.push("workspace");
  }
  if (next.brandGem !== prev.brandGem && !isPaused("brandGem")) {
    changed.push("brandGem");
  }
  if (next.periods !== prev.periods && !isPaused("periods")) {
    changed.push("periods");
    periodTokenChange = { prevToken: prev.periods, nextToken: next.periods };
  }
  if (next.registry !== prev.registry && !isPaused("registry")) {
    changed.push("registry");
  }

  return { changed, periodTokenChange };
}

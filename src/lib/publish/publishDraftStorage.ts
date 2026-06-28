export function publishDraftStorageKey(clientId: string, planningPeriodId: string): string {
  return `ag_publish_drafts:${clientId}:${planningPeriodId}`;
}

export function loadPublishDrafts(
  clientId: string,
  planningPeriodId: string
): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(publishDraftStorageKey(clientId, planningPeriodId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePublishDrafts(
  clientId: string,
  planningPeriodId: string,
  drafts: Record<string, string>
): void {
  if (typeof window === "undefined") return;
  const key = publishDraftStorageKey(clientId, planningPeriodId);
  if (Object.keys(drafts).length === 0) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(drafts));
}

export function clearPublishDrafts(clientId: string, planningPeriodId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(publishDraftStorageKey(clientId, planningPeriodId));
}

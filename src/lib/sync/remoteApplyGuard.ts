let remoteApplyDepth = 0;

const syncedFingerprints = new Map<string, string>();

export function beginRemoteWorkspaceApply(): void {
  remoteApplyDepth += 1;
}

export function endRemoteWorkspaceApply(): void {
  remoteApplyDepth = Math.max(0, remoteApplyDepth - 1);
}

export function isApplyingRemoteWorkspace(): boolean {
  return remoteApplyDepth > 0;
}

/** Marca o PATCH como já persistido (ex.: após pull remoto) para não reenviar ao servidor. */
export function markWorkspacePatchSynced(clientId: string, fingerprint: string): void {
  if (!clientId || !fingerprint) return;
  syncedFingerprints.set(clientId, fingerprint);
}

export function isWorkspacePatchAlreadySynced(
  clientId: string,
  fingerprint: string
): boolean {
  return syncedFingerprints.get(clientId) === fingerprint;
}

export function clearWorkspacePatchSync(clientId: string): void {
  syncedFingerprints.delete(clientId);
}

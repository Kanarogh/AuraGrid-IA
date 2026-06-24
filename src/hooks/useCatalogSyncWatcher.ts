/**
 * @deprecated Absorvido por useRemoteSyncCoordinator. Mantido só para compatibilidade.
 */
export function useCatalogSyncWatcher(_options: unknown) {
  return {
    syncNow: async () => null,
    setKnownRevision: (_revision: string) => {},
  };
}

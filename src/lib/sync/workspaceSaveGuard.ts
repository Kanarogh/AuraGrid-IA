let workspaceSavePending = false;

export function setWorkspaceSavePending(pending: boolean): void {
  workspaceSavePending = pending;
}

export function isWorkspaceSavePending(): boolean {
  return workspaceSavePending;
}

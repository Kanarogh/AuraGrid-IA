import type { ApiWorkspaceResponse } from "../api/workspaceApi";
import { apiWorkspaceToClientWorkspace } from "../api/workspaceApi";
import type { ClientWorkspace } from "../clientWorkspace";
import type { SyncDomain } from "./types";

export type WorkspaceReloadSlice = {
  catalog?: boolean;
  workspace?: boolean;
  brandGem?: boolean;
};

export function slicesFromDomains(domains: SyncDomain[]): WorkspaceReloadSlice {
  return {
    catalog: domains.includes("catalog"),
    workspace: domains.includes("workspace"),
    brandGem: domains.includes("brandGem"),
  };
}

export function applyWorkspaceDtoSlices(
  prev: ClientWorkspace,
  dto: ApiWorkspaceResponse,
  slices: WorkspaceReloadSlice
): ClientWorkspace {
  const ws = apiWorkspaceToClientWorkspace(dto);
  const next: ClientWorkspace = { ...prev };

  if (slices.catalog) next.catalog = ws.catalog;
  if (slices.brandGem) {
    next.brandGem = ws.brandGem;
    next.startDate = ws.startDate;
  }
  if (slices.workspace) {
    next.posts = ws.posts;
    next.startDate = ws.startDate;
    next.canva = { ...prev.canva, ...ws.canva };
  }

  return next;
}

export function needsWorkspaceFetch(slices: WorkspaceReloadSlice): boolean {
  return !!(slices.catalog || slices.workspace || slices.brandGem);
}

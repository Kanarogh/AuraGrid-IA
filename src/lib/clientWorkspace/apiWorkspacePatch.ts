import type { ClientWorkspace } from "./types";
import { normalizeCaptionGenerationParams } from "../captionParams";
import { compactCanvaForApiPatch, compactPostForApiPatch } from "./persistence";

export type WorkspaceApiPatchOptions = {
  /** Preferências de navegação (post ativo, seção). Não entra no autosave. */
  includeUi?: boolean;
};

function compactBrandGemForApiPatch(gem: ClientWorkspace["brandGem"]) {
  return {
    ...gem,
    captionParams: normalizeCaptionGenerationParams(gem.captionParams),
    footer: {
      structure: gem.footer?.structure ?? "",
      address: gem.footer?.address ?? "",
      contact: gem.footer?.contact ?? "",
      hashtags: gem.footer?.hashtags ?? "",
      extra: gem.footer?.extra ?? "",
      customFields: gem.footer?.customFields ?? [],
    },
  };
}

function buildWorkspaceContentBody(ws: ClientWorkspace) {
  return {
    brandGem: compactBrandGemForApiPatch(ws.brandGem),
    startDate: ws.startDate,
    planningPeriodId: ws.activePlanningPeriodId,
    posts: ws.posts.map(compactPostForApiPatch),
    contentSchedule: ws.contentSchedule ?? [],
    contentScheduleBrief: ws.contentScheduleBrief ?? "",
    contentScheduleOptions: ws.contentScheduleOptions ?? {
      postCount: 9,
      storyCount: 12,
      extraInstructions: "",
    },
    canva: compactCanvaForApiPatch(ws.canva),
  };
}

/** PATCH de conteúdo editável — sem ui de navegação. */
export function buildWorkspaceContentPatch(ws: ClientWorkspace) {
  if (ws.isReadOnly) return null;
  return buildWorkspaceContentBody(ws);
}

/** Fingerprint para autosave — ignora troca de dia/seção na UI. */
export function workspaceContentFingerprint(ws: ClientWorkspace): string | null {
  const patch = buildWorkspaceContentPatch(ws);
  return patch ? JSON.stringify(patch) : null;
}

export function buildWorkspaceApiPatch(
  ws: ClientWorkspace,
  options?: WorkspaceApiPatchOptions
) {
  const content = buildWorkspaceContentPatch(ws);
  if (!content) return null;
  if (!options?.includeUi) return content;
  return { ...content, ui: ws.ui };
}

/** Alias do fingerprint de conteúdo (compatível com guards de sync). */
export function workspaceApiPatchFingerprint(ws: ClientWorkspace): string | null {
  return workspaceContentFingerprint(ws);
}

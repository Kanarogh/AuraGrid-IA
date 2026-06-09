import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import {
  createClientForUser,
  loadWorkspaceDto,
  patchWorkspace,
  saveBrandGem,
  setActiveClient,
} from "@/server/services/clientService";
import { createCatalogItem } from "@/server/services/catalogService";
import { uploadMediaBuffer } from "@/server/services/mediaService";

export const dynamic = "force-dynamic";

type LegacyExport = {
  registry?: {
    activeClientId?: string;
    clients?: Array<{
      id: string;
      name: string;
      instagramHandle?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  };
  workspaces?: Record<
    string,
    {
      brandGem?: Record<string, unknown>;
      catalog?: Array<Record<string, unknown>>;
      posts?: Array<Record<string, unknown>>;
      startDate?: string;
      canva?: Record<string, unknown>;
      ui?: Record<string, unknown>;
    }
  >;
};

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  if (!dataUrl?.startsWith("data:")) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1]!, buffer: Buffer.from(match[2]!, "base64") };
}

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const userId = user.id;
    const payload = (await req.json()) as LegacyExport;
    const registryClients = payload.registry?.clients ?? [];
    const workspaces = payload.workspaces ?? {};
    const imported: string[] = [];

    for (const meta of registryClients) {
      let clientId = meta.id;
      try {
        await createClientForUser(userId, meta.name, clientId);
      } catch {
        clientId = `${meta.id}-${randomBytes(2).toString("hex")}`;
        await createClientForUser(userId, meta.name, clientId);
      }

      const ws = workspaces[meta.id];
      if (!ws) {
        imported.push(clientId);
        continue;
      }

      if (ws.brandGem) {
        await saveBrandGem(userId, clientId, {
          name: String(ws.brandGem.name ?? meta.name),
          description: String(ws.brandGem.description ?? ""),
          instructions: String(ws.brandGem.instructions ?? ""),
          campaignContext: String(ws.brandGem.campaignContext ?? ""),
          captionParams: ws.brandGem.captionParams,
          footer: ws.brandGem.footer,
        });
      }

      const catalog = Array.isArray(ws.catalog) ? ws.catalog : [];
      for (const item of catalog) {
        const image = typeof item.image === "string" ? item.image : "";
        const parsed = dataUrlToBuffer(image);
        if (!parsed) continue;
        const id = String(item.id ?? `cat_${Date.now()}`);
        const media = await uploadMediaBuffer({
          clientId,
          userId,
          buffer: parsed.buffer,
          mimeType: parsed.mimeType,
          kind: "catalog",
          fileName: `${id}.jpg`,
        });
        await createCatalogItem({
          clientId,
          id,
          label: String(item.label ?? id),
          description: typeof item.description === "string" ? item.description : undefined,
          imageAssetId: media.id,
          isReference: item.isReference !== false,
        });
      }

      await patchWorkspace(userId, clientId, {
        startDate: ws.startDate,
        ui: ws.ui,
        canva: ws.canva,
        posts: ws.posts,
      });

      imported.push(clientId);
    }

    if (imported.length > 0) {
      await setActiveClient(
        userId,
        payload.registry?.activeClientId && imported.includes(payload.registry.activeClientId)
          ? payload.registry.activeClientId
          : imported[0]!
      );
    }

    const activeId =
      payload.registry?.activeClientId && imported.includes(payload.registry.activeClientId)
        ? payload.registry.activeClientId
        : imported[0];

    return NextResponse.json({
      ok: true,
      imported,
      workspace: activeId ? await loadWorkspaceDto(userId, activeId) : null,
    });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

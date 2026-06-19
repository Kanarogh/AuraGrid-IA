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

const MEDIA_ID_RE = /\/api\/v1\/media\/([0-9a-f-]{36})/i;

async function persistLegacyImageAsset(
  clientId: string,
  userId: string,
  image: unknown,
  kind: "canva" | "posts" | "catalog",
  fileName: string,
  existingAssetId?: unknown
): Promise<string | null> {
  if (typeof existingAssetId === "string" && existingAssetId.trim()) {
    return existingAssetId;
  }
  if (typeof image !== "string" || !image) return null;
  const fromUrl = image.match(MEDIA_ID_RE);
  if (fromUrl) return fromUrl[1]!;
  const parsed = dataUrlToBuffer(image);
  if (!parsed) return null;
  const media = await uploadMediaBuffer({
    clientId,
    userId,
    buffer: parsed.buffer,
    mimeType: parsed.mimeType,
    kind,
    fileName,
  });
  return media.id;
}

async function hydrateLegacyCanvaImages(
  clientId: string,
  userId: string,
  canva: Record<string, unknown> | undefined
): Promise<Record<string, unknown> | undefined> {
  if (!canva || !Array.isArray(canva.pages)) return canva;
  const pages = await Promise.all(
    (canva.pages as Array<Record<string, unknown>>).map(async (page) => {
      if (!Array.isArray(page.slots)) return page;
      const slots = await Promise.all(
        (page.slots as Array<Record<string, unknown>>).map(async (slot, idx) => {
          const imageAssetId = await persistLegacyImageAsset(
            clientId,
            userId,
            slot.image,
            "canva",
            `slot_${String(slot.id ?? idx)}.jpg`,
            slot.imageAssetId
          );
          return {
            ...slot,
            image: null,
            imageAssetId: imageAssetId ?? slot.imageAssetId ?? null,
          };
        })
      );
      return { ...page, slots };
    })
  );
  return { ...canva, pages };
}

async function hydrateLegacyPostImages(
  clientId: string,
  userId: string,
  posts: unknown
): Promise<unknown> {
  if (!Array.isArray(posts)) return posts;
  return Promise.all(
    posts.map(async (post) => {
      if (!post || typeof post !== "object") return post;
      const row = post as Record<string, unknown>;
      const imageAssetId = await persistLegacyImageAsset(
        clientId,
        userId,
        row.image,
        "posts",
        `${String(row.id ?? "post")}.jpg`,
        row.imageAssetId
      );
      return {
        ...row,
        image: null,
        imageAssetId: imageAssetId ?? row.imageAssetId ?? null,
      };
    })
  );
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
        canva: await hydrateLegacyCanvaImages(clientId, userId, ws.canva as Record<string, unknown>),
        posts: await hydrateLegacyPostImages(clientId, userId, ws.posts),
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

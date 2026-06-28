import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { assertClientAccess, getOptionalUser, getOptionalUserFromRequest } from "@/server/http/auth";
import { POSTS_READ, POSTS_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { getMediaBuffer, deleteMediaAsset } from "@/server/services/mediaService";
import { resizeMediaBuffer } from "@/server/services/mediaResize";
import { getDb } from "@/server/db/client";
import { mediaAssets } from "@/server/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ assetId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { assetId } = await params;
    const user = await getOptionalUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { buffer, mimeType, clientId } = await getMediaBuffer(assetId);
    await assertClientAccess(user, clientId, POSTS_READ);

    const widthParam = req.nextUrl.searchParams.get("w");
    const requestedWidth = widthParam ? Number.parseInt(widthParam, 10) : 0;

    let body: Buffer = buffer;
    let contentType = mimeType;

    if (requestedWidth > 0 && Number.isFinite(requestedWidth)) {
      try {
        const resized = await resizeMediaBuffer(buffer, mimeType, requestedWidth);
        body = resized.buffer;
        contentType = resized.mimeType;
      } catch (resizeErr) {
        console.warn(
          "[media] resize falhou, servindo original:",
          resizeErr instanceof Error ? resizeErr.message : resizeErr
        );
      }
    }

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          requestedWidth > 0
            ? "private, max-age=86400, stale-while-revalidate=604800"
            : "private, max-age=3600",
      },
    });
  } catch (err) {
    return errorResponse(err, 404);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { assetId } = await params;
    const user = getOptionalUser(req);
    if (!user) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    const db = getDb();
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
    await assertClientAccess(user, row.clientId, POSTS_WRITE);
    await deleteMediaAsset(assetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { assertClientAccess, getOptionalUser, getOptionalUserFromRequest } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { getMediaBuffer, deleteMediaAsset } from "@/server/services/mediaService";
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
    await assertClientAccess(user, clientId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
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
    await assertClientAccess(user, row.clientId);
    await deleteMediaAsset(assetId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

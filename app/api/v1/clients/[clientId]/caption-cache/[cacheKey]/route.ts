import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { POSTS_READ, POSTS_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { getCaptionCache, removeCaptionCacheEntry, setCaptionCache } from "@/server/services/captionCacheService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; cacheKey: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, cacheKey } = await params;
    await assertClientAccess(user, clientId, POSTS_READ);
    const hit = await getCaptionCache(clientId, cacheKey);
    return NextResponse.json({ hit });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, cacheKey } = await params;
    await assertClientAccess(user, clientId, POSTS_WRITE);
    const value = await req.json();
    await setCaptionCache(clientId, cacheKey, value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, cacheKey } = await params;
    await assertClientAccess(user, clientId, POSTS_WRITE);
    await removeCaptionCacheEntry(clientId, cacheKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

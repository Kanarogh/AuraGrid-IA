import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { deleteCatalogItem } from "@/server/services/catalogService";
import { getDb } from "@/server/db/client";
import { plannedPosts } from "@/server/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; itemId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, itemId } = await params;
    await assertClientAccess(user, clientId);
    await deleteCatalogItem(clientId, itemId);
    const db = getDb();
    await db
      .update(plannedPosts)
      .set({ matchedCatalogId: null })
      .where(eq(plannedPosts.matchedCatalogId, itemId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

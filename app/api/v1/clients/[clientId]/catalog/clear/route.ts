import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { clearCatalog } from "@/server/services/catalogService";
import { stopCatalogEnrichment } from "@/server/services/enrichQueue";
import { getDb } from "@/server/db/client";
import { plannedPosts } from "@/server/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    stopCatalogEnrichment(clientId);
    await clearCatalog(clientId);
    const db = getDb();
    await db
      .update(plannedPosts)
      .set({ matchedCatalogId: null })
      .where(eq(plannedPosts.clientId, clientId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CATALOG_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { listCatalogItems, updateCatalogItem } from "@/server/services/catalogService";
import { stopCatalogEnrichment } from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_WRITE);
    stopCatalogEnrichment(clientId);
    const items = await listCatalogItems(clientId);
    for (const item of items.filter((i) => i.enrichmentStatus === "processing")) {
      await updateCatalogItem(clientId, item.id, {
        enrichmentStatus: "pending",
        enrichmentError: null,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

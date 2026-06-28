import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CATALOG_READ } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import {
  getCatalogEnrichmentSnapshot,
  resetStaleProcessingCatalogItems,
} from "@/server/services/catalogService";
import {
  deriveEnrichProgressFromSnapshot,
  isSnapshotEnriching,
} from "@/server/services/catalogEnrichmentSnapshot";
import {
  getEnrichmentProgressResolved,
  isEnrichmentRunningResolved,
} from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_READ);

    if (await isEnrichmentRunningResolved(clientId)) {
      const progress = await getEnrichmentProgressResolved(clientId);
      return NextResponse.json({ enriching: true, progress });
    }

    try {
      await resetStaleProcessingCatalogItems(clientId);
    } catch (err) {
      console.warn(
        "[enrich/status] reset de processing órfão ignorado:",
        err instanceof Error ? err.message : err
      );
    }
    const snapshot = await getCatalogEnrichmentSnapshot(clientId);

    if (isSnapshotEnriching(snapshot)) {
      return NextResponse.json({
        enriching: true,
        progress: deriveEnrichProgressFromSnapshot(snapshot),
      });
    }

    return NextResponse.json({ enriching: false, progress: null });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

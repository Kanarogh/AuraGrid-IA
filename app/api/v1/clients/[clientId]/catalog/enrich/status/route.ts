import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
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
  getEnrichmentProgress,
  isEnrichmentRunning,
} from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);

    if (isEnrichmentRunning(clientId)) {
      const progress = getEnrichmentProgress(clientId);
      return NextResponse.json({ enriching: true, progress });
    }

    await resetStaleProcessingCatalogItems(clientId);
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

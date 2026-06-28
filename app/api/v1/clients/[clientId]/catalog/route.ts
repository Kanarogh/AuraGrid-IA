import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CATALOG_READ, CATALOG_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { createCatalogItem, listCatalogItems } from "@/server/services/catalogService";
import { isEnrichmentRunning } from "@/server/services/enrichQueue";
import { getEffectiveUsesReferences } from "@/server/services/planningPeriodService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_READ);
    const items = await listCatalogItems(clientId);
    return NextResponse.json({ items, enriching: isEnrichmentRunning(clientId) });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_WRITE);
    const {
      id,
      label,
      description,
      imageAssetId,
      isReference: isReferenceBody,
    } = (await req.json()) as {
      id?: string;
      label?: string;
      description?: string;
      imageAssetId?: string;
      isReference?: boolean;
    };
    if (!label?.trim() || !imageAssetId) {
      return NextResponse.json(
        { error: "label e imageAssetId são obrigatórios." },
        { status: 400 }
      );
    }
    const itemId = id ?? `cat_${Date.now()}`;
    const isReference = isReferenceBody !== false;
    if (isReference) {
      const usesReferences = await getEffectiveUsesReferences(clientId);
      if (!usesReferences) {
        return NextResponse.json(
          { error: "Este roteiro não aceita referências. Envie apenas peças de grid." },
          { status: 400 }
        );
      }
    }
    const item = await createCatalogItem({
      clientId,
      id: itemId,
      label: label.trim(),
      description,
      imageAssetId,
      isReference,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

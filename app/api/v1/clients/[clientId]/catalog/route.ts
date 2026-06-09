import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { createCatalogItem, listCatalogItems } from "@/server/services/catalogService";
import { isEnrichmentRunning } from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
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
    await assertClientAccess(user, clientId);
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
    const item = await createCatalogItem({
      clientId,
      id: itemId,
      label: label.trim(),
      description,
      imageAssetId,
      isReference: isReferenceBody !== false,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

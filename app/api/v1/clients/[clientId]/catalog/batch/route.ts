import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { createCatalogItem } from "@/server/services/catalogService";
import { uploadMediaBuffer } from "@/server/services/mediaService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }

    const isReferenceRaw = String(form.get("isReference") ?? "").trim().toLowerCase();
    const isReference = isReferenceRaw !== "false" && isReferenceRaw !== "0";

    let labels: string[] = [];
    const labelsRaw = form.get("labels");
    if (typeof labelsRaw === "string" && labelsRaw.trim()) {
      try {
        const parsed = JSON.parse(labelsRaw) as unknown;
        if (Array.isArray(parsed)) {
          labels = parsed.map((v) => String(v ?? "").trim());
        }
      } catch {
        /* usa rótulo do nome do arquivo */
      }
    }

    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const mimeType = file.type || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      const id = `cat_${Date.now()}_${i}_${randomBytes(4).toString("hex")}`;
      const originalName = file.name || `${id}.${ext}`;
      const labelFromClient = labels[i]?.trim();
      let label = labelFromClient
        ? labelFromClient
        : originalName
            .replace(/\.[^/.]+$/, "")
            .replace(/[_-]/g, " ")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());
      if (!label) label = id;

      const buffer = Buffer.from(await file.arrayBuffer());
      const media = await uploadMediaBuffer({
        clientId,
        userId: user.id,
        buffer,
        mimeType,
        kind: "catalog",
        fileName: `${id}.${ext}`,
      });

      const item = await createCatalogItem({
        clientId,
        id,
        label,
        description: isReference
          ? `Importado em ${new Date().toLocaleDateString("pt-BR")} do arquivo '${originalName}'`
          : `Peça de grid importada em ${new Date().toLocaleDateString("pt-BR")} do arquivo '${originalName}' — não usada como referência de look`,
        imageAssetId: media.id,
        isReference,
      });
      created.push(item);
    }

    return NextResponse.json({ items: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { uploadMediaBuffer } from "@/server/services/mediaService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    const kindRaw = String(form.get("kind") ?? "media");
    const kind =
      kindRaw === "catalog" || kindRaw === "canva" || kindRaw === "posts" ? kindRaw : "media";

    const mimeType = file.type || "image/jpeg";
    const ext = mimeType.split("/")[1] || "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMediaBuffer({
      clientId,
      userId: user.id,
      buffer,
      mimeType,
      kind,
      fileName,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, 500);
  }
}

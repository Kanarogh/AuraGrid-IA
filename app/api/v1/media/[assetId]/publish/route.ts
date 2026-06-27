import { NextResponse, type NextRequest } from "next/server";
import { serveSignedPublishMedia } from "@/server/services/mediaPublishUrl";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ assetId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { assetId } = await params;
    const exp = Number.parseInt(req.nextUrl.searchParams.get("exp") ?? "", 10);
    const sig = req.nextUrl.searchParams.get("sig") ?? "";
    if (!Number.isFinite(exp) || !sig) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
    const media = await serveSignedPublishMedia(assetId, exp, sig);
    if (!media) {
      return NextResponse.json({ error: "Link expirado ou inválido." }, { status: 401 });
    }
    return new NextResponse(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        "Content-Type": media.mimeType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Mídia indisponível." }, { status: 404 });
  }
}

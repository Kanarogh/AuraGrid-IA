import { NextResponse, type NextRequest } from "next/server";
import {
  isServerSyncDebugEnabled,
  serverSyncDebugLog,
} from "@/server/sync/syncDebugLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  event?: string;
  payload?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  if (!isServerSyncDebugEnabled()) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = (await req.json()) as Body;
    const event = typeof body.event === "string" ? body.event : "client.unknown";
    const payload = body.payload && typeof body.payload === "object" ? body.payload : undefined;
    serverSyncDebugLog(`client.${event}`, payload);
    return NextResponse.json({ ok: true });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}

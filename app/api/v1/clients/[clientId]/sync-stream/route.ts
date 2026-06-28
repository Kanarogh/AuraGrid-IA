import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, getOptionalUserFromRequest } from "@/server/http/auth";
import { CONTENT_SCHEDULE_READ } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import {
  subscribeSyncStream,
  unsubscribeSyncStream,
  type SseOutboundEvent,
} from "@/server/sync/syncEventHub";
import { serverSyncDebugLog } from "@/server/sync/syncDebugLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

const HEARTBEAT_MS = 25_000;

function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function encodeComment(comment: string): string {
  return `: ${comment}\n\n`;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getOptionalUserFromRequest(req);
    if (!user) {
      return errorResponse(new Error("Autenticação necessária."), 401);
    }

    const { clientId } = await params;
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_READ);
    const periodId = req.nextUrl.searchParams.get("periodId") ?? "";

    let subscriberId = "";
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };

        const onEvent = (event: SseOutboundEvent) => {
          if (event.type === "connected") {
            send(encodeSse("connected", { ok: true }));
            return;
          }
          if (event.type === "enrich") {
            serverSyncDebugLog("sse.event", {
              clientId,
              type: "enrich",
              enriching: event.payload.enrich?.enriching,
            });
            send(encodeSse("enrich", event.payload.enrich ?? { enriching: false }));
            return;
          }
          serverSyncDebugLog("sse.event", {
            clientId,
            type: "revision",
            domains: event.payload.domains,
          });
          send(
            encodeSse("revision", {
              domains: event.payload.domains,
              periodId: event.payload.periodId,
            })
          );
        };

        subscriberId = subscribeSyncStream(user.id, clientId, periodId, onEvent);
        serverSyncDebugLog("sse.connect", {
          userId: user.id,
          clientId,
          periodId,
          subscriberId,
        });
        send(encodeSse("connected", { ok: true }));

        heartbeat = setInterval(() => {
          send(encodeComment("ping"));
        }, HEARTBEAT_MS);
      },
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (subscriberId) {
          serverSyncDebugLog("sse.disconnect", { clientId, subscriberId });
          unsubscribeSyncStream(subscriberId);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

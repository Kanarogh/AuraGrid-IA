import { NextResponse, type NextRequest } from "next/server";
import { formatAiError } from "@/server/ai/index";
import { matchOperationHeaders, runMatchOperation } from "@/server/ai/matchOrchestrator";
import { sanitizeMatchOperationInput } from "@/server/ai/operations";
import { applyAiHeadersFromNextRequest, aiAttemptsHeaderValue } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let providerId = await applyAiHeadersFromNextRequest(req);
  try {
    const body = await req.json();
    const { postImage, clientId } = body;

    if (!postImage) {
      return NextResponse.json({ error: "No query image provided." }, { status: 400 });
    }

    const sanitized = sanitizeMatchOperationInput("match-reference", {
      postImage,
      clientId: typeof clientId === "string" ? clientId : undefined,
      catalogProfiles: body.catalogProfiles,
      catalogItems: body.catalogItems,
      matchOnly: true,
    });

    const operation = await runMatchOperation("match-reference", sanitized, providerId);
    providerId = operation.providerUsed;

    const headers = new Headers(matchOperationHeaders(operation));
    headers.set("X-AI-Provider-Used", operation.providerUsed);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(operation.attempts));

    return NextResponse.json(
      {
        matchedId: operation.result.matchedId,
        reasoning: operation.result.reasoning,
        matchMode: operation.result.matchMode,
        providerUsed: operation.providerUsed,
      },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error matching catalog reference:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
  }
}

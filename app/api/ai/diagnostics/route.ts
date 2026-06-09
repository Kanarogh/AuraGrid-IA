import { NextResponse } from "next/server";
import { getAiDiagnosticsSnapshot } from "@/server/ai/diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAiDiagnosticsSnapshot());
}

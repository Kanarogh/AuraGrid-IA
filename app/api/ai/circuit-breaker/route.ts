import { NextResponse } from "next/server";
import { getCircuitBreakerSnapshot } from "@/server/ai/circuitBreaker";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getCircuitBreakerSnapshot());
}

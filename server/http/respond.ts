import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function errorResponse(err: unknown, fallbackStatus = 500): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: fallbackStatus });
}

/** Status 429 quando a mensagem indica cota/rate limit, senão o fallback. */
export function aiErrorStatus(err: unknown, fallback = 500): number {
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(err)) ? 429 : fallback;
}

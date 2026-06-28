export function envString(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const JWT_SECRET = envString("JWT_SECRET", "dev-jwt-secret-change-me");
export const JWT_ACCESS_TTL = envString("JWT_ACCESS_TTL", "15m");
export const JWT_REFRESH_TTL_DAYS = envInt("JWT_REFRESH_TTL_DAYS", 30);

/** When false (default in production), public /register is disabled. */
export const ALLOW_PUBLIC_REGISTER =
  envString("AURAGRID_ALLOW_PUBLIC_REGISTER", "0") === "1";

export const MINIO_ENDPOINT = envString("MINIO_ENDPOINT", "localhost");
export const MINIO_PORT = envInt("MINIO_PORT", 9000);
export const MINIO_USE_SSL = envString("MINIO_USE_SSL", "false") === "true";
export const MINIO_ACCESS_KEY = envString("MINIO_ACCESS_KEY", "auragrid");
export const MINIO_SECRET_KEY = envString("MINIO_SECRET_KEY", "auragridsecret");
export const MINIO_BUCKET = envString("MINIO_BUCKET", "auragrid-media");
export const MINIO_PUBLIC_ENDPOINT = envString("MINIO_PUBLIC_ENDPOINT", MINIO_ENDPOINT);

export const MAX_UPLOAD_BYTES = envInt("MAX_UPLOAD_BYTES", 15 * 1024 * 1024);

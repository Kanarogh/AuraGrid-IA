import fs from "fs";
import path from "path";
import type postgres from "postgres";

function normalizeInlineCert(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function readCertFromBase64Env(): string | undefined {
  const b64 = process.env.DATABASE_SSL_CERT_BASE64?.trim();
  if (!b64) return undefined;
  const cleaned = b64.replace(/\s+/g, "");
  return Buffer.from(cleaned, "base64").toString("utf-8");
}

/** SSL exigido pelo PostgreSQL gerenciado da Square Cloud (certificate.pem). */
export function getPostgresSsl():
  | { ca: string; key: string; cert: string; rejectUnauthorized: true }
  | undefined {
  const fromBase64 = readCertFromBase64Env();
  if (fromBase64?.includes("BEGIN")) {
    return { ca: fromBase64, key: fromBase64, cert: fromBase64, rejectUnauthorized: true };
  }

  const inline = process.env.DATABASE_SSL_CERT?.trim();
  if (inline && inline.includes("BEGIN")) {
    const cert = normalizeInlineCert(inline);
    return { ca: cert, key: cert, cert, rejectUnauthorized: true };
  }

  const certPath = process.env.DATABASE_SSL_CERT_PATH?.trim();
  if (!certPath) return undefined;

  const full = path.isAbsolute(certPath)
    ? certPath
    : path.join(process.cwd(), "certs", path.basename(certPath));
  const cert = fs.readFileSync(full, "utf-8");
  return { ca: cert, key: cert, cert, rejectUnauthorized: true };
}

export function postgresConnectOptions(
  overrides: postgres.Options<Record<string, postgres.PostgresType>> = {}
): postgres.Options<Record<string, postgres.PostgresType>> {
  const ssl = getPostgresSsl();
  return ssl ? { ...overrides, ssl } : overrides;
}

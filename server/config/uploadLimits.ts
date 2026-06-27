import { MAX_UPLOAD_BYTES } from "./env";

/** Máximo de arquivos por request de batch upload de catálogo. */
export const MAX_CATALOG_BATCH_FILES = 50;

export function assertUploadSize(byteLength: number, label = "Arquivo"): void {
  if (byteLength > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    throw new Error(`${label} excede o limite de ${mb} MB.`);
  }
}

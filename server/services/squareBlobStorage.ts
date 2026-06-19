import {
  getSquareBlobApiKey,
  SQUARE_BLOB_EXPIRE_DAYS,
  SQUARE_BLOB_PUBLIC_BASE,
} from "../config/mediaStorage";

const BLOB_API = "https://blob.squarecloud.app/v1";

type BlobUploadResponse = {
  status: string;
  response?: { id: string; name: string; size: number; url: string };
  code?: string;
  message?: string;
};

let lastUploadAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Prefixo/nome Blob: a-z, A-Z, 0-9, _ (3–32 chars). */
export function sanitizeBlobToken(raw: string, maxLen = 32): string {
  let s = raw.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (s.length < 3) {
    s = `ag_${Date.now().toString(36)}`;
    s = s.replace(/[^a-zA-Z0-9_]/g, "_");
  }
  return s.slice(0, maxLen);
}

function blobNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "") || "media";
  const sanitized = sanitizeBlobToken(base, 32);
  return sanitized.length >= 3 ? sanitized : `img_${sanitized}`.slice(0, 32);
}

async function throttleBlobUpload(): Promise<void> {
  const elapsed = Date.now() - lastUploadAt;
  if (elapsed < 1100) await sleep(1100 - elapsed);
}

export async function checkSquareBlobConnection(): Promise<boolean> {
  const apiKey = getSquareBlobApiKey();
  if (!apiKey) return false;
  try {
    const res = await fetch(`${BLOB_API}/stats`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "success";
  } catch {
    return false;
  }
}

export async function uploadSquareBlobObject(input: {
  clientId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ blobId: string; publicUrl: string; byteSize: number }> {
  const apiKey = getSquareBlobApiKey();
  if (!apiKey) throw new Error("Square Cloud Blob não configurado (SQUARECLOUD_BLOB_API_KEY).");

  const prefix = sanitizeBlobToken(input.clientId, 32);
  const name = blobNameFromFileName(input.fileName);

  const params = new URLSearchParams({
    name,
    prefix,
    expire: String(Math.min(365, Math.max(1, SQUARE_BLOB_EXPIRE_DAYS))),
  });

  const attempt = async (): Promise<BlobUploadResponse> => {
    await throttleBlobUpload();
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.fileName
    );

    const res = await fetch(`${BLOB_API}/objects?${params}`, {
      method: "POST",
      headers: { Authorization: apiKey },
      body: form,
    });
    lastUploadAt = Date.now();
    return (await res.json()) as BlobUploadResponse;
  };

  let data = await attempt();
  if (data.code === "RATELIMIT" || data.code === "TOO_MANY_CONCURRENT_UPLOADS") {
    await sleep(1500);
    data = await attempt();
  }

  if (data.status !== "success" || !data.response?.id) {
    throw new Error(
      data.code
        ? `Square Blob upload falhou (${data.code}).`
        : "Square Blob upload falhou."
    );
  }

  const publicUrl =
    data.response.url || `${SQUARE_BLOB_PUBLIC_BASE}/${data.response.id}`;

  return {
    blobId: data.response.id,
    publicUrl,
    byteSize: data.response.size ?? input.buffer.byteLength,
  };
}

export function squareBlobPublicUrl(blobId: string): string {
  return `${SQUARE_BLOB_PUBLIC_BASE}/${blobId}`;
}

export async function downloadSquareBlobObject(blobId: string): Promise<Buffer> {
  const url = squareBlobPublicUrl(blobId);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao baixar blob (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteSquareBlobObject(blobId: string): Promise<void> {
  const apiKey = getSquareBlobApiKey();
  if (!apiKey) return;

  const res = await fetch(`${BLOB_API}/objects`, {
    method: "DELETE",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ object: blobId }),
  });

  const data = (await res.json()) as { status?: string; code?: string };
  if (data.status === "success" || data.code === "OBJECT_NOT_FOUND") return;
  if (data.code === "INVALID_OBJECT") return;
  throw new Error(
    data.code ? `Square Blob delete falhou (${data.code}).` : "Square Blob delete falhou."
  );
}

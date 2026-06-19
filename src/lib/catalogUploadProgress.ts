import type { CatalogItem } from "../types";
import { readApiJson } from "./api/apiClient";
import { getAccessToken } from "./api/apiClient";
import {
  computeOverallUploadPercent,
  estimateUploadEtaSeconds,
} from "./uploadProgress";

export type CatalogUploadPhase = "processing" | "uploading" | "done" | "error";

export type CatalogUploadProgressState = {
  phase: CatalogUploadPhase;
  current: number;
  total: number;
  fileName: string;
  label: string;
  filePercent: number;
  overallPercent: number;
  bytesLoaded: number;
  bytesTotal: number;
  startedAt: number;
  succeeded: number;
  failed: number;
  etaSeconds: number | null;
  statusMessage?: string;
};

export function createInitialUploadProgress(total: number): CatalogUploadProgressState {
  return {
    phase: "processing",
    current: 0,
    total,
    fileName: "",
    label: "",
    filePercent: 0,
    overallPercent: 0,
    bytesLoaded: 0,
    bytesTotal: 0,
    startedAt: Date.now(),
    succeeded: 0,
    failed: 0,
    etaSeconds: null,
    statusMessage: "Preparando envio…",
  };
}

function buildProgress(
  base: Pick<
    CatalogUploadProgressState,
    "startedAt" | "total" | "succeeded" | "failed" | "phase"
  >,
  current: number,
  file: { name: string; label: string },
  phase: CatalogUploadPhase,
  filePercent: number,
  bytes: { loaded: number; total: number },
  statusMessage?: string
): CatalogUploadProgressState {
  const overallPercent = computeOverallUploadPercent(base.total, current, filePercent);
  return {
    ...base,
    phase,
    current,
    fileName: file.name,
    label: file.label,
    filePercent,
    overallPercent,
    bytesLoaded: bytes.loaded,
    bytesTotal: bytes.total,
    etaSeconds: estimateUploadEtaSeconds(base.startedAt, base.total, current, filePercent),
    statusMessage,
  };
}

async function postFormDataWithProgress(
  path: string,
  form: FormData,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Response> {
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.withCredentials = true;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };

    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      const type = xhr.getResponseHeader("Content-Type") ?? "application/json";
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          headers: { "Content-Type": type },
        })
      );
    };

    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Falha de rede durante o upload."));
    };

    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelado.", "AbortError"));
    };

    xhr.send(form);
  });
}

export async function uploadCatalogCandidatesSequential(
  clientId: string,
  candidates: { file: File; label: string }[],
  options: {
    isReference?: boolean;
    signal?: AbortSignal;
    onProgress: (state: CatalogUploadProgressState) => void;
  }
): Promise<{
  items: CatalogItem[];
  errors: { fileName: string; message: string }[];
  cancelled?: boolean;
}> {
  const items: CatalogItem[] = [];
  const errors: { fileName: string; message: string }[] = [];
  const total = candidates.length;
  const startedAt = Date.now();
  let succeeded = 0;
  let failed = 0;

  const base = () => ({
    startedAt,
    total,
    succeeded,
    failed,
    phase: "uploading" as CatalogUploadPhase,
  });

  options.onProgress(createInitialUploadProgress(total));

  for (let i = 0; i < candidates.length; i++) {
    if (options.signal?.aborted) {
      return { items, errors, cancelled: true };
    }

    const { file, label } = candidates[i]!;
    const index = i + 1;
    const fileSize = file.size || 0;

    options.onProgress(
      buildProgress(
        base(),
        index,
        { name: file.name, label },
        "uploading",
        0,
        { loaded: 0, total: fileSize },
        `Enviando ${index} de ${total}…`
      )
    );

    const form = new FormData();
    form.append("files", file);
    form.append("labels", JSON.stringify([label]));
    if (options.isReference === false) form.append("isReference", "false");

    try {
      const res = await postFormDataWithProgress(
        `/api/v1/clients/${clientId}/catalog/batch`,
        form,
        (loaded, totalBytes) => {
          const pct = totalBytes > 0 ? Math.round((loaded / totalBytes) * 100) : 0;
          options.onProgress(
            buildProgress(
              base(),
              index,
              { name: file.name, label },
              "uploading",
              pct,
              { loaded, total: totalBytes || fileSize },
              `Enviando ${index} de ${total}…`
            )
          );
        },
        options.signal
      );

      const data = await readApiJson<{ items: CatalogItem[] }>(res);
      const created = data.items?.[0];
      if (created) {
        items.push(created);
        succeeded++;
      } else {
        failed++;
        errors.push({ fileName: file.name, message: "Resposta vazia do servidor." });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { items, errors, cancelled: true };
      }
      failed++;
      errors.push({
        fileName: file.name,
        message: err instanceof Error ? err.message : "Falha no upload.",
      });
    }

    options.onProgress(
      buildProgress(
        base(),
        index,
        { name: file.name, label },
        "uploading",
        100,
        { loaded: fileSize, total: fileSize },
        index < total ? `Concluído ${index} de ${total}` : "Finalizando…"
      )
    );
  }

  return { items, errors };
}

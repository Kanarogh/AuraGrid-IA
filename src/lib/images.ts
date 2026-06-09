export function resizeImage(
  base64Str: string,
  maxWidth = 500,
  maxHeight = 500
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width || 500;
      let height = img.height || 500;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
}

/**
 * Compressão otimizada para envio à IA de visão.
 * 1024px lado maior + JPEG 0.82 mantém detalhes de moda e corta ~75% dos tokens
 * vs PNG cru exportado do Canva (1–2 MB).
 */
export function resizeForAi(
  base64Str: string,
  options: { maxSide?: number; quality?: number } = {}
): Promise<string> {
  const maxSide = options.maxSide ?? 1024;
  const quality = options.quality ?? 0.82;

  return resizeImageDataUrl(base64Str, { maxSide, quality, minSideToReencode: maxSide });
}

/** Guarda referências do catálogo com alta fidelidade (só reduz se exceder o limite). */
export const CATALOG_STORAGE_MAX_SIDE = 2048;
export const CATALOG_STORAGE_QUALITY = 0.92;

export function resizeForCatalogStorage(base64Str: string): Promise<string> {
  return resizeImageDataUrl(base64Str, {
    maxSide: CATALOG_STORAGE_MAX_SIDE,
    quality: CATALOG_STORAGE_QUALITY,
    minSideToReencode: CATALOG_STORAGE_MAX_SIDE,
  });
}

/** Fallback quando o localStorage enche — ainda boa para grid e match. */
export const CATALOG_STORAGE_EMERGENCY_MAX_SIDE = 1024;
export const CATALOG_STORAGE_EMERGENCY_QUALITY = 0.82;

export function resizeForCatalogStorageEmergency(base64Str: string): Promise<string> {
  return resizeImageDataUrl(base64Str, {
    maxSide: CATALOG_STORAGE_EMERGENCY_MAX_SIDE,
    quality: CATALOG_STORAGE_EMERGENCY_QUALITY,
    minSideToReencode: 256,
  });
}

/** Envio à IA na indexação — alta resolução, não altera o arquivo salvo no catálogo. */
export const CATALOG_ENRICH_MAX_SIDE = 1536;
export const CATALOG_ENRICH_QUALITY = 0.88;

export function resizeForCatalogEnrich(base64Str: string): Promise<string> {
  return resizeImageDataUrl(base64Str, {
    maxSide: CATALOG_ENRICH_MAX_SIDE,
    quality: CATALOG_ENRICH_QUALITY,
    minSideToReencode: CATALOG_ENRICH_MAX_SIDE,
  });
}

type ResizeImageOptions = {
  maxSide: number;
  quality: number;
  /** Só reencoda JPEG se o lado maior for >= este valor; imagens menores ficam intactas */
  minSideToReencode?: number;
};

function resizeImageDataUrl(
  base64Str: string,
  options: ResizeImageOptions
): Promise<string> {
  const { maxSide, quality, minSideToReencode = maxSide } = options;

  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:")) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const w0 = img.width || maxSide;
      const h0 = img.height || maxSide;
      const longest = Math.max(w0, h0);

      if (longest <= minSideToReencode && !base64Str.startsWith("data:image/svg")) {
        resolve(base64Str);
        return;
      }

      const scale = longest > maxSide ? maxSide / longest : 1;
      const width = Math.max(1, Math.round(w0 * scale));
      const height = Math.max(1, Math.round(h0 * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64Str);
  });
}

export async function fileToCatalogImageDataUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  return resizeForCatalogStorage(raw);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

export function convertSvgToDataUrl(svgDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!svgDataUrl?.startsWith("data:image/svg+xml")) {
      resolve(svgDataUrl);
      return;
    }
    const img = new Image();
    img.src = svgDataUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#F4F4F5";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        resolve(svgDataUrl);
      }
    };
    img.onerror = () => resolve(svgDataUrl);
  });
}

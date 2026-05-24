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

      if (longest <= maxSide && base64Str.startsWith("data:image/jpeg")) {
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

/** Extrai arquivo de imagem do clipboard (Ctrl+V). */
export function getImageFileFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

async function blobToImageFile(blob: Blob, name = "imagem.png"): Promise<File | null> {
  if (!blob.type.startsWith("image/")) return null;
  return new File([blob], name, { type: blob.type || "image/png" });
}

async function fetchImageAsFile(url: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return blobToImageFile(blob);
  } catch {
    return null;
  }
}

/** Arquivo ou URL de imagem solta no slot (arrastar do desktop ou, às vezes, do navegador). */
export async function getImageFileFromDataTransfer(dt: DataTransfer): Promise<File | null> {
  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (f.type.startsWith("image/")) return f;
    }
  }

  const html = dt.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    const src = img?.getAttribute("src");
    if (src?.startsWith("data:image/")) {
      const res = await fetch(src);
      const blob = await res.blob();
      const fromData = await blobToImageFile(blob);
      if (fromData) return fromData;
    }
    if (src?.startsWith("http")) {
      const fromUrl = await fetchImageAsFile(src);
      if (fromUrl) return fromUrl;
    }
  }

  const uri = dt.getData("text/uri-list")?.trim().split("\n").find((l) => l && !l.startsWith("#"));
  if (uri?.startsWith("http")) {
    return fetchImageAsFile(uri);
  }

  return null;
}

export const CATALOG_DRAG_MIME = "application/x-auragrid-catalog-id";

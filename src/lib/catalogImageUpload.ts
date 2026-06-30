const IMAGE_EXT =
  /\.(jpe?g|png|webp|gif|svg|bmp|tiff?|heic|heif|avif)$/i;

const SKIP_FILE_NAMES = new Set([
  "thumbs.db",
  "desktop.ini",
  ".ds_store",
]);

export function getFileRelativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return rel?.replace(/\\/g, "/") ?? file.name;
}

function catalogFileDedupeKey(file: File): string {
  return `${getFileRelativePath(file)}|${file.size}|${file.lastModified}`;
}

export function dedupeCatalogImageFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const file of files) {
    const key = catalogFileDedupeKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

export function isCatalogImageFile(file: File): boolean {
  const baseName = file.name.trim();
  if (!baseName || baseName.startsWith(".")) return false;
  if (SKIP_FILE_NAMES.has(baseName.toLowerCase())) return false;
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(baseName);
}

export function formatCatalogLabel(raw: string): string {
  const cleaned = raw
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]/g, " ")
    .trim();
  if (!cleaned) return raw.trim();
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Nome da pasta pai (código da referência) ou nome do arquivo sem extensão. */
export function labelFromCatalogImageFile(file: File): string {
  const rel = getFileRelativePath(file);
  const parts = rel.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return formatCatalogLabel(parts[parts.length - 2]!);
  }
  return formatCatalogLabel(parts[0] ?? file.name);
}

function fileStemName(file: File): string {
  return file.name.replace(/\.[^/.]+$/, "");
}

export function isGenericPhotoName(stem: string): boolean {
  return /^(img|dsc|image|foto|photo|capture|pic)[\s_-]?\d*$/i.test(stem.trim());
}

/**
 * Código da pasta + detalhe do arquivo quando o nome da foto também traz referência.
 * Ex.: Fotos(6)/#00874/9146-pink-front.jpg → "#00874 9146 Pink Front"
 */
export function referenceLabelFromFolderAndFile(file: File): string {
  const rel = getFileRelativePath(file);
  const parts = rel.split("/").filter(Boolean);
  const fileStem = formatCatalogLabel(fileStemName(file));

  if (parts.length < 2) {
    return fileStem;
  }

  const folderRef = formatCatalogLabel(parts[parts.length - 2]!);
  const stemRaw = fileStemName(file);
  const folderNorm = folderRef.toLowerCase().replace(/[\s#_-]/g, "");
  const stemNorm = stemRaw.toLowerCase().replace(/[\s#_-]/g, "");

  if (!stemRaw || stemNorm === folderNorm || stemNorm.includes(folderNorm)) {
    return folderRef;
  }

  if (isGenericPhotoName(stemRaw)) {
    return folderRef;
  }

  return `${folderRef} ${fileStem}`;
}

export type CatalogUploadCandidate = {
  file: File;
  label: string;
};

/**
 * Importa todas as imagens das subpastas.
 * O rótulo combina código da pasta + nome da foto quando ambos trazem referência.
 */
export function prepareCatalogUploadCandidates(
  files: File[],
  options: { asReference: boolean }
): CatalogUploadCandidate[] {
  const images = dedupeCatalogImageFiles(files.filter(isCatalogImageFile));
  if (images.length === 0) return [];

  const hasNestedPaths = images.some((f) => getFileRelativePath(f).includes("/"));

  const candidates = images.map((file) => ({
    file,
    label:
      options.asReference && hasNestedPaths
        ? referenceLabelFromFolderAndFile(file)
        : labelFromCatalogImageFile(file),
  }));

  return candidates.sort((a, b) => {
    const pathA = getFileRelativePath(a.file);
    const pathB = getFileRelativePath(b.file);
    const byPath = pathA.localeCompare(pathB, undefined, { numeric: true, sensitivity: "base" });
    if (byPath !== 0) return byPath;
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });
}

async function readDirectoryEntries(
  dir: FileSystemDirectoryEntry,
  basePath: string,
  out: File[]
): Promise<void> {
  const reader = dir.createReader();

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const entry of batch) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        try {
          Object.defineProperty(file, "webkitRelativePath", {
            value: entryPath,
            configurable: true,
          });
        } catch {
          /* ignora se o browser não permitir */
        }
        out.push(file);
      } else if (entry.isDirectory) {
        await readDirectoryEntries(entry as FileSystemDirectoryEntry, entryPath, out);
      }
    }
  } while (batch.length > 0);
}

/** Arrastar pasta no Windows não preenche files recursivamente — percorre com webkitGetAsEntry. */
export async function collectFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (!items?.length) return dedupeCatalogImageFiles(Array.from(dt.files));

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i]?.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) return dedupeCatalogImageFiles(Array.from(dt.files));

  const files: File[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        files.push(file);
      } else if (entry.isDirectory) {
        await readDirectoryEntries(entry as FileSystemDirectoryEntry, entry.name, files);
      }
    })
  );

  const collected = files.length > 0 ? files : Array.from(dt.files);
  return dedupeCatalogImageFiles(collected);
}

export function enableFolderPickerInput(input: HTMLInputElement | null) {
  if (!input) return;
  input.type = "file";
  input.multiple = true;
  input.removeAttribute("accept");
  const el = input as HTMLInputElement & { webkitdirectory?: boolean; mozdirectory?: boolean };
  el.webkitdirectory = true;
  el.mozdirectory = true;
  input.setAttribute("webkitdirectory", "");
  input.setAttribute("directory", "");
}

async function readDirectoryHandle(
  dir: FileSystemDirectoryHandle,
  basePath: string
): Promise<File[]> {
  const files: File[] = [];
  for await (const [name, handle] of (
    dir as unknown as {
      entries: () => AsyncIterable<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
    }
  ).entries()) {
    const path = basePath ? `${basePath}/${name}` : name;
    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      try {
        Object.defineProperty(file, "webkitRelativePath", {
          value: path,
          configurable: true,
        });
      } catch {
        /* ignora se o browser não permitir */
      }
      files.push(file);
    } else if (handle.kind === "directory") {
      files.push(...(await readDirectoryHandle(handle as FileSystemDirectoryHandle, path)));
    }
  }
  return files;
}

function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Abre o seletor de PASTA (não de arquivos).
 * Preferimos input webkitdirectory: um único fluxo no Chrome/Brave.
 * showDirectoryPicker fica só como fallback se o input não existir.
 */
export async function pickFilesFromFolder(
  legacyInput?: HTMLInputElement | null
): Promise<File[] | null> {
  if (legacyInput) {
    enableFolderPickerInput(legacyInput);

    const fromInput = await new Promise<File[] | null>((resolve) => {
      const onChange = () => {
        legacyInput.removeEventListener("change", onChange);
        const picked = legacyInput.files ? Array.from(legacyInput.files) : [];
        legacyInput.value = "";
        resolve(picked);
      };
      legacyInput.addEventListener("change", onChange);
      legacyInput.click();
    });

    if (fromInput !== null) {
      return fromInput;
    }
  }

  if (!supportsDirectoryPicker()) return null;

  try {
    const handle = await (
      window as unknown as {
        showDirectoryPicker: (opts: { mode: "read" }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker({ mode: "read" });
    return await readDirectoryHandle(handle, handle.name);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    console.warn("[AuraStudio] showDirectoryPicker falhou:", err);
    return null;
  }
}

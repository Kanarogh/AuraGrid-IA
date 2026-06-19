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

function pickBestImageFile(files: File[]): File {
  return [...files].sort((a, b) => b.size - a.size)[0]!;
}

export type CatalogUploadCandidate = {
  file: File;
  label: string;
};

/**
 * Pastas de referência costumam ser: Raiz/#00874/foto.jpg — uma pasta = um look.
 * Agrupa por pasta pai e escolhe a melhor imagem quando há várias no mesmo código.
 */
export function prepareCatalogUploadCandidates(
  files: File[],
  options: { asReference: boolean }
): CatalogUploadCandidate[] {
  const images = files.filter(isCatalogImageFile);
  if (images.length === 0) return [];

  const hasNestedPaths = images.some((f) => getFileRelativePath(f).includes("/"));

  if (!options.asReference || !hasNestedPaths) {
    return images.map((file) => ({
      file,
      label: labelFromCatalogImageFile(file),
    }));
  }

  const groups = new Map<string, File[]>();

  for (const file of images) {
    const parts = getFileRelativePath(file).split("/").filter(Boolean);
    if (parts.length < 2) {
      const key = `__root__:${file.name}`;
      const list = groups.get(key) ?? [];
      list.push(file);
      groups.set(key, list);
      continue;
    }

    const parentFolder = parts[parts.length - 2]!;
    const list = groups.get(parentFolder) ?? [];
    list.push(file);
    groups.set(parentFolder, list);
  }

  const candidates: CatalogUploadCandidate[] = [];

  for (const [key, groupFiles] of groups) {
    if (key.startsWith("__root__:")) {
      const file = pickBestImageFile(groupFiles);
      candidates.push({ file, label: labelFromCatalogImageFile(file) });
      continue;
    }

    const file = pickBestImageFile(groupFiles);
    candidates.push({
      file,
      label: formatCatalogLabel(key),
    });
  }

  return candidates.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
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
  if (!items?.length) return Array.from(dt.files);

  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i]?.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) return Array.from(dt.files);

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

  return files.length > 0 ? files : Array.from(dt.files);
}

export function enableFolderPickerInput(input: HTMLInputElement | null) {
  if (!input) return;
  input.setAttribute("webkitdirectory", "");
  input.setAttribute("directory", "");
  input.multiple = true;
}

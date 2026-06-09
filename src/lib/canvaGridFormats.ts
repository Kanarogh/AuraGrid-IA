export type CanvaGridFormatId = "square" | "portrait" | "landscape" | "stories";

export type CanvaGridFormat = {
  id: CanvaGridFormatId;
  label: string;
  ratioLabel: string;
  dimensions: string;
  /** Proporção CSS width / height */
  aspectRatio: number;
  defaultMaxWidth: number;
  zoomMin: number;
  zoomMax: number;
  accent: string;
  previewBg: string;
};

export const CANVA_GRID_FORMATS: CanvaGridFormat[] = [
  {
    id: "square",
    label: "Square",
    ratioLabel: "1:1",
    dimensions: "1080×1080",
    aspectRatio: 1,
    defaultMaxWidth: 480,
    zoomMin: 280,
    zoomMax: 1400,
    accent: "text-pink-500",
    previewBg: "bg-pink-200/80 dark:bg-pink-500/25",
  },
  {
    id: "portrait",
    label: "Portrait",
    ratioLabel: "4:5",
    dimensions: "1080×1350",
    aspectRatio: 4 / 5,
    defaultMaxWidth: 440,
    zoomMin: 260,
    zoomMax: 1200,
    accent: "text-fuchsia-600",
    previewBg: "bg-fuchsia-200/80 dark:bg-fuchsia-500/25",
  },
  {
    id: "landscape",
    label: "Landscape",
    ratioLabel: "16:9",
    dimensions: "1080×566",
    aspectRatio: 16 / 9,
    defaultMaxWidth: 640,
    zoomMin: 320,
    zoomMax: 1600,
    accent: "text-violet-600",
    previewBg: "bg-violet-200/80 dark:bg-violet-500/25",
  },
  {
    id: "stories",
    label: "Stories",
    ratioLabel: "9:16",
    dimensions: "1080×1920",
    aspectRatio: 9 / 16,
    defaultMaxWidth: 360,
    zoomMin: 200,
    zoomMax: 900,
    accent: "text-sky-600",
    previewBg: "bg-sky-200/80 dark:bg-sky-500/25",
  },
];

export const DEFAULT_CANVA_GRID_FORMAT: CanvaGridFormatId = "square";

export function getCanvaGridFormat(id?: CanvaGridFormatId | null): CanvaGridFormat {
  return CANVA_GRID_FORMATS.find((f) => f.id === id) ?? CANVA_GRID_FORMATS[0]!;
}

export function isCanvaGridFormatId(value: unknown): value is CanvaGridFormatId {
  return (
    value === "square" ||
    value === "portrait" ||
    value === "landscape" ||
    value === "stories"
  );
}

/** Largura do preview no seletor de formato (px). */
export function formatPreviewSize(format: CanvaGridFormat): { width: number; height: number } {
  const base = 56;
  if (format.aspectRatio >= 1) {
    return { width: base, height: Math.round(base / format.aspectRatio) };
  }
  return { width: Math.round(base * format.aspectRatio), height: base };
}

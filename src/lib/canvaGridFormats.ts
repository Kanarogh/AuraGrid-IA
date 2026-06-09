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
    accent: "text-ag-accent",
    previewBg: "bg-ag-accent-soft",
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
    accent: "text-ag-accent",
    previewBg: "bg-ag-accent-soft",
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
    accent: "text-ag-accent",
    previewBg: "bg-ag-accent-soft",
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
    accent: "text-ag-accent",
    previewBg: "bg-ag-accent-soft",
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

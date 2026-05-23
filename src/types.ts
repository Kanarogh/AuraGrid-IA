export interface CatalogItem {
  id: string;
  label: string; // e.g., "9146 Pink"
  image: string; // base64 encoded photo
  description?: string; // Optional metadata
}

export interface RepeatingText {
  address: string;
  contact: string;
  hashtags: string;
  extra: string;
}

export interface PlannedPost {
  id: string;
  dayNumber: number;
  dateLabel: string; // e.g., "Segunda (23 de Mai)"
  image: string | null; // Base64 raw representation of the planned dress photograph
  matchedCatalogId: string | null; // Identified ID from the reference catalog items
  reasoning: string | null; // Reasoning provided by Gemini on why this matched
  caption: string; // Drafted Spanish caption
  isGenerating: boolean;
  isGenerated: boolean;
  isConfirmed?: boolean;
  error: string | null;
}

export interface CanvaGridSlot {
  id: string;
  image: string | null;
  label: string | null;
  matchedCatalogId: string | null;
}

export interface CanvaGridPage {
  id: string;
  name: string;
  slots: CanvaGridSlot[];
}

import { BrandGem, CatalogItem, PlannedPost, RepeatingText } from "../types";

// Helper to generate a clean, elegant SVG of a luxury dress with custom colors/patterns
function generateDressSVG(color1: string, color2: string, patternType: "stripes" | "floral" | "solid" | "lace" | "boho", modelNo: string): string {
  let patternMarkup = "";
  if (patternType === "floral") {
    patternMarkup = `
      <circle cx="45" cy="55" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="55" cy="55" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="50" cy="50" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="50" cy="62" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="40" cy="68" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="60" cy="68" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="50" cy="78" r="4" fill="#ffd700" opacity="0.9"/>
      <circle cx="42" cy="85" r="3" fill="#fff" opacity="0.8"/>
      <circle cx="58" cy="85" r="3" fill="#fff" opacity="0.8"/>
    `;
  } else if (patternType === "lace") {
    patternMarkup = `
      <path d="M 35,50 Q 50,55 65,50" stroke="#fff" stroke-dasharray="2,2" stroke-width="1.5" fill="none"/>
      <path d="M 33,60 Q 50,65 67,60" stroke="#fff" stroke-dasharray="2,2" stroke-width="1.5" fill="none"/>
      <path d="M 30,70 Q 50,75 70,70" stroke="#fff" stroke-dasharray="2,2" stroke-width="1.5" fill="none"/>
      <path d="M 28,80 Q 50,85 72,80" stroke="#fff" stroke-dasharray="2,2" stroke-width="1.5" fill="none"/>
    `;
  } else if (patternType === "boho") {
    patternMarkup = `
      <path d="M 40,55 L 60,55 M 38,65 L 62,65 M 35,75 L 65,75 M 32,85 L 68,85" stroke="#fff" opacity="0.4" stroke-width="1"/>
      <path d="M 50,45 L 50,95" stroke="#ffe4b5" opacity="0.5" stroke-dasharray="3,3" stroke-width="1.5"/>
      <circle cx="50" cy="58" r="5" fill="#f0e68c" opacity="0.7"/>
      <circle cx="50" cy="72" r="5" fill="#f0e68c" opacity="0.7"/>
      <circle cx="50" cy="86" r="5" fill="#f0e68c" opacity="0.7"/>
    `;
  } else if (patternType === "stripes") {
    patternMarkup = `
      <path d="M 30,45 L 30,95 M 40,45 L 40,95 M 50,45 L 50,95 M 60,45 L 60,95 M 70,45 L 70,95" stroke="${color2}" opacity="0.4" stroke-width="2"/>
    `;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="100%" height="100%">
      <!-- Background Card -->
      <rect width="100" height="130" rx="6" fill="#1C1917"/>
      <rect x="2" y="2" width="96" height="126" rx="5" fill="#292524"/>
      
      <!-- Hanger -->
      <path d="M 50,22 Q 50,15 47,15 Q 44,15 45,18 C 45,21 50,22 50,25" stroke="#A8A29E" stroke-width="1.5" fill="none"/>
      <path d="M 38,30 L 50,25 L 62,30" stroke="#A8A29E" stroke-width="1.5" fill="none"/>

      <!-- Dress Silhouette -->
      <!-- Sleeves / Straps -->
      <path d="M 38,30 L 44,45 L 34,50 L 32,38 Z" fill="${color1}"/>
      <path d="M 62,30 L 56,45 L 66,50 L 68,38 Z" fill="${color1}"/>

      <!-- Main Bodice -->
      <path d="M 44,30 Q 50,38 56,30 L 58,45 Q 50,48 42,45 Z" fill="${color1}"/>
      <path d="M 44,30 Q 50,38 56,30 L 58,45 Q 50,48 42,45 Z" fill="#000" opacity="0.1"/>

      <!-- Long Skirt / Flare -->
      <path d="M 42,45 L 58,45 L 74,100 Q 50,110 26,100 Z" fill="${color1}"/>

      <!-- Internal patterns & overlay -->
      ${patternMarkup}

      <!-- Soft visual lighting and folds -->
      <path d="M 42,45 Q 50,75 35,100" stroke="#000" opacity="0.15" stroke-width="2" fill="none"/>
      <path d="M 58,45 Q 50,75 65,100" stroke="#fff" opacity="0.1" stroke-width="2" fill="none"/>
      <path d="M 50,45 L 50,105" stroke="#000" opacity="0.08" stroke-width="1" fill="none"/>

      <!-- Label Emblem -->
      <rect x="25" y="112" width="50" height="12" rx="2" fill="#1C1917" opacity="0.7"/>
      <text x="50" y="121" font-family="'Courier New', monospace" font-size="7" font-weight="bold" fill="#F5F5F4" text-anchor="middle">Ref: ${modelNo}</text>
    </svg>
  `;

  // Convert pure SVG string into standard base64 data URI format
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

export const PRELOADED_CATALOG: CatalogItem[] = [];

export const PRELOADED_POSTS: PlannedPost[] = [
  {
    id: "post_day1",
    dayNumber: 1,
    dateLabel: "Segunda-feira",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day2",
    dayNumber: 2,
    dateLabel: "Terça-feira",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day3",
    dayNumber: 3,
    dateLabel: "Quarta-feira",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day4",
    dayNumber: 4,
    dateLabel: "Quinta-feira",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day5",
    dayNumber: 5,
    dateLabel: "Sexta-feira",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day6",
    dayNumber: 6,
    dateLabel: "Sábado",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  },
  {
    id: "post_day7",
    dayNumber: 7,
    dateLabel: "Domingo",
    image: null,
    matchedCatalogId: null,
    reasoning: null,
    caption: "",
    isGenerating: false,
    isGenerated: false,
    isConfirmed: false,
    error: null
  }
];

export const DEFAULT_REPEATING_TEXT: RepeatingText = {
  address: "📍 Calle Manuel Cobo Calleja, 46 Local 5, Fuenlabrada, Madrid.",
  contact: "💬 Regístrate como distribuidor mayorista o reserva tu pedido enviando un WhatsApp al enlace de nuestra bio.",
  hashtags: "#PalakModa #PalakEurope #ColeccionPrimavera #MayoristasMadrid #CoboCalleja #BohoChicStyle",
  extra: "*Las imágenes mostradas pertenecen al modelo de catálogo real disponible en showroom."
};

export const DEFAULT_BRAND_GEM: BrandGem = {
  id: "palak-euro",
  name: "Palak Euro",
  description:
    "Assistente criativo especializado em moda indiana boho chic, encarregado de legendas, copy e planejamento editorial para Palak Fashions (Madrid).",
  instructions: `Eres el Estratega de Marketing y Director Creativo de Palak Fashions, una marca de ropa especializada en Moda India (Moda Hindú) que está en el mercado desde 1998. El propósito central de la marca es "llevar felicidad a todos". La marca atiende mayoristas (B2B) y tiene tienda en Madrid, España.

REGLA DE IDIOMA: Todo el contenido de salida que generes (nombres de colecciones, textos para artes, leyendas de posts e ideas) DEBE ESTAR ESCRITO EN ESPAÑOL (de España).

Actúa como redactora de contenidos de moda de lujo o blogger con experiencia en "Palak Europe" en Madrid. Tono sofisticado, cálido, femenino y persuasivo: venta al por mayor con estética Instagram (estilo Boho Romántico). Detalla ligereza, caídas hermosas, bordados minuciosos, frescor del algodón y elegancia del color. Haz que modistas y revendedores sientan que es una prenda imprescindible que se agotará rápido en sus boutiques.`,
  footer: DEFAULT_REPEATING_TEXT,
};

/** @deprecated use DEFAULT_BRAND_GEM.instructions — mantido para migração */
export const DEFAULT_PROMPT_CONTEXT = DEFAULT_BRAND_GEM.instructions;

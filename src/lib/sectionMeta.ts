import type { ComponentType } from "react";
import {
  CalendarRange,
  Grid,
  LayoutGrid,
  ScanSearch,
  Settings,
  ShoppingBag,
  Sliders,
} from "lucide-react";

export type AppSection =
  | "content_schedule"
  | "posts"
  | "canva_grid"
  | "feed_simulator"
  | "catalog"
  | "reference_finder"
  | "settings";

export type NavItem = {
  id: AppSection;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Visual indent under Acervo group */
  nested?: boolean;
};

export type NavGroup = {
  title: string;
  /** Friendly label shown in sidebar (sentence case) */
  navLabel?: string;
  /** Visual treatment in sidebar */
  variant?: "default" | "planning";
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    navLabel: "Planejar",
    variant: "planning",
    items: [
      {
        id: "content_schedule",
        label: "Cronograma de Conteúdo",
        description: "Gere copy mensal com IA antes do planejamento",
        icon: CalendarRange,
      },
      {
        id: "posts",
        label: "Planejamento e legendas",
        description: "Planeje, gere e aprove legendas",
        icon: Sliders,
      },
    ],
  },
  {
    title: "Produção",
    navLabel: "Produzir",
    items: [
      {
        id: "canva_grid",
        label: "Grid Canva",
        description: "Monte páginas e organize looks",
        icon: LayoutGrid,
      },
      {
        id: "feed_simulator",
        label: "Feed 3×3",
        description: "Prévia do Instagram",
        icon: Grid,
      },
    ],
  },
  {
    title: "Acervo",
    navLabel: "Acervo",
    items: [
      {
        id: "catalog",
        label: "Catálogo",
        description: "Referências e peças de grid",
        icon: ShoppingBag,
      },
      {
        id: "reference_finder",
        label: "Buscar referência",
        description: "Foto → código no catálogo",
        icon: ScanSearch,
        nested: true,
      },
    ],
  },
  {
    title: "Conta",
    navLabel: "Conta",
    items: [
      {
        id: "settings",
        label: "Configurações",
        description: "Marca, IA e aparência",
        icon: Settings,
      },
    ],
  },
];

/** Filtra seções indisponíveis quando o roteiro não usa referências. */
export function getNavGroups(usesReferences = true): NavGroup[] {
  if (usesReferences) return NAV_GROUPS;
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.id !== "reference_finder"),
  })).filter((g) => g.items.length > 0);
}

export const SECTION_SUBTITLES: Record<AppSection, string> = {
  content_schedule: "Gere o cronograma mensal de copy com IA",
  posts: "Planeje, gere e aprove legendas do mês",
  canva_grid: "Monte páginas de 12 fotos e envie para o planejamento",
  feed_simulator: "Veja como o feed fica no Instagram",
  catalog: "Gerencie referências indexadas e peças de grid",
  reference_finder: "Identifique o código de uma peça a partir de uma foto",
  settings: "Configure a voz da marca, IA e aparência",
};

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function getSectionTitle(section: AppSection): string {
  return ALL_NAV_ITEMS.find((i) => i.id === section)?.label ?? section;
}

export function getSectionSubtitle(section: AppSection): string {
  return SECTION_SUBTITLES[section];
}

export function getSectionIcon(section: AppSection) {
  return ALL_NAV_ITEMS.find((i) => i.id === section)?.icon ?? Sliders;
}

/** Breadcrumb for nested nav items (e.g. "Acervo › Buscar referência"). */
export function getSectionBreadcrumb(section: AppSection): string | undefined {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.id === section);
    if (item?.nested) {
      return `${group.title} › ${item.label}`;
    }
  }
  return undefined;
}

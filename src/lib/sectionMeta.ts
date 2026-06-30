import type { ComponentType } from "react";
import {
  CalendarClock,
  CalendarRange,
  Cpu,
  Grid,
  LayoutGrid,
  Palette,
  ScanSearch,
  Settings,
  ShoppingBag,
  Sliders,
  Users,
} from "lucide-react";
import type { AccountTab } from "./appRouting/types";

export type AppSection =
  | "content_schedule"
  | "posts"
  | "post_scheduling"
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

export type AccountNavItem = {
  id: AccountTab;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export type NavGroup = {
  title: string;
  /** Friendly label shown in sidebar (sentence case) */
  navLabel?: string;
  /** Visual treatment in sidebar */
  variant?: "default" | "planning";
  items: NavItem[];
};

export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  {
    id: "team",
    label: "Equipe",
    description: "Membros, convites e permissões da conta",
    icon: Users,
  },
  {
    id: "appearance",
    label: "Aparência",
    description: "Cor de destaque e personalização visual",
    icon: Palette,
  },
  {
    id: "ai",
    label: "IA",
    description: "Modelos Gemini usados em todo o workspace",
    icon: Cpu,
  },
];

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
      {
        id: "post_scheduling",
        label: "Programar posts",
        description: "Agende publicações nas redes sociais conectadas",
        icon: CalendarClock,
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
        description: "Monte páginas e organize o conteúdo visual",
        icon: LayoutGrid,
      },
      {
        id: "feed_simulator",
        label: "Feed 3×3",
        description: "Prévia do feed social",
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
        description: "Referências indexadas e peças de grid",
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
    title: "Cliente",
    navLabel: "Cliente",
    items: [
      {
        id: "settings",
        label: "Configurações do cliente",
        description: "Marca, Gem e legendas",
        icon: Settings,
      },
    ],
  },
];

/** Filtra seções indisponíveis quando o roteiro não usa referências ou sem permissão. */
export function getNavGroups(
  usesReferences = true,
  canAccessSection?: (section: AppSection) => boolean
): NavGroup[] {
  let groups = usesReferences
    ? NAV_GROUPS
    : NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((item) => item.id !== "reference_finder"),
      })).filter((g) => g.items.length > 0);

  if (canAccessSection) {
    groups = groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => canAccessSection(item.id)),
      }))
      .filter((g) => g.items.length > 0);
  }

  return groups;
}

export function getAccountNavItems(options?: {
  canManageTeam?: boolean;
}): AccountNavItem[] {
  const canManageTeam = options?.canManageTeam ?? false;
  return ACCOUNT_NAV_ITEMS.filter((item) => {
    if (item.id === "team" || item.id === "ai") return canManageTeam;
    return true;
  });
}

export const ACCOUNT_TAB_LABELS: Record<AccountTab, string> = {
  team: "Equipe",
  appearance: "Aparência",
  ai: "IA",
};

export const ACCOUNT_TAB_SUBTITLES: Record<AccountTab, string> = {
  team: "Membros, convites e permissões da conta",
  appearance: "Cor de destaque e personalização visual",
  ai: "Modelos Gemini para legendas, catálogo e cronograma",
};

export function getAccountTabTitle(tab: AccountTab): string {
  return ACCOUNT_TAB_LABELS[tab];
}

export function getAccountTabSubtitle(tab: AccountTab): string {
  return ACCOUNT_TAB_SUBTITLES[tab];
}

export const SECTION_SUBTITLES: Record<AppSection, string> = {
  content_schedule: "Gere o cronograma mensal de copy com IA",
  posts: "Planeje, gere e aprove legendas do mês",
  post_scheduling: "Publique nas redes sociais conectadas o que já foi aprovado",
  canva_grid: "Monte páginas de 12 fotos e envie para o planejamento",
  feed_simulator: "Veja como o feed fica nas redes sociais",
  catalog: "Gerencie referências indexadas e peças de grid",
  reference_finder: "Identifique o código de uma peça a partir de uma foto",
  settings: "Configure a voz da marca e parâmetros de legenda",
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

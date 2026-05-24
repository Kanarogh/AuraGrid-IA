import type { PlannedPost } from "../types";

/**
 * Ordem de exibição no perfil Instagram: canto superior esquerdo = post mais recente
 * (último dia do plano); as primeiras publicações ficam na parte inferior do grid.
 */
export function sortPostsForInstagramProfile(posts: PlannedPost[]): PlannedPost[] {
  return [...posts].sort((a, b) => {
    if (b.dayNumber !== a.dayNumber) return b.dayNumber - a.dayNumber;
    return a.id.localeCompare(b.id);
  });
}

/** Índice visual no grid (0 = topo-esquerda) → rótulo de leitura para o usuário */
export function instagramGridPositionLabel(index: number, cols = 3): {
  row: number;
  col: number;
} {
  return { row: Math.floor(index / cols) + 1, col: (index % cols) + 1 };
}

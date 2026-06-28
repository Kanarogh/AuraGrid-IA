import type { PlannedPost } from "../types";
import { isPublishReadyPost, publishReadinessIssuesFromPost } from "./publish/publishReadiness";

export interface PostStatusStyle {
  label: string;
  badge: string;
  dot: string;
}

export function getPostStatus(post: PlannedPost | null | undefined): PostStatusStyle {
  if (!post || !post.image) {
    return {
      label: "Sem imagem",
      badge: "bg-ag-muted/10 text-ag-muted border-ag-border",
      dot: "bg-ag-muted",
    };
  }
  if (post.isGenerating) {
    return {
      label: "Gerando legenda…",
      badge: "bg-ag-warning/10 text-ag-warning border-ag-warning/25",
      dot: "bg-ag-warning animate-pulse",
    };
  }
  if (post.error) {
    return {
      label: "Erro na IA",
      badge: "bg-ag-danger/10 text-ag-danger border-ag-danger/25",
      dot: "bg-ag-danger",
    };
  }
  if (isPublishReadyPost(post)) {
    return {
      label: "Pronto para publicar",
      badge: "bg-ag-success/10 text-ag-success border-ag-success/25",
      dot: "bg-ag-success",
    };
  }
  if (post.isConfirmed) {
    const issues = publishReadinessIssuesFromPost(post);
    if (issues.includes("foto")) {
      return {
        label: "Aprovado — falta foto",
        badge: "bg-ag-warning/10 text-ag-warning border-ag-warning/25",
        dot: "bg-ag-warning",
      };
    }
    return {
      label: "Aprovado",
      badge: "bg-ag-success/10 text-ag-success border-ag-success/25",
      dot: "bg-ag-success",
    };
  }
  if (post.isGenerated) {
    return {
      label: "Revisão pendente",
      badge: "bg-ag-accent/10 text-ag-accent border-ag-accent/25",
      dot: "bg-ag-accent",
    };
  }
  return {
    label: "Sem rascunho",
    badge: "bg-ag-surface-2 text-ag-muted border-ag-border",
    dot: "bg-ag-muted/60",
  };
}

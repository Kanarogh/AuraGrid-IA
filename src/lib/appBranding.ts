export const APP_NAME = "AuraStudio IA";
export const APP_NAME_SHORT = "AuraStudio";

/** Tagline curta — footer, sidebar, login. */
export const APP_TAGLINE =
  "Planejamento e produção de conteúdo para redes sociais";

/** Meta description e SEO. */
export const APP_DESCRIPTION =
  "Plataforma para planejamento e produção de conteúdo para redes sociais voltada a clientes de uma agência de marketing digital.";

/** Resumo completo do produto — apresentações, welcome, docs. */
export const APP_SUMMARY =
  "Plataforma para planejamento e produção de conteúdo para redes sociais voltada a clientes de uma agência de marketing digital. Cobre o ciclo completo: definir a voz da marca → gerar copy mensal com IA → montar grid visual → produzir roteiro de 30 dias com legendas e, se necessário, match de referências → agendar e publicar nas redes sociais conectadas.";

export const APP_WORKSPACE_SUMMARY =
  "Cada marca/cliente tem seu próprio workspace com cronograma, catálogo, grid, roteiro e publicação. Em produção, suporta múltiplos usuários por conta com permissões por equipe.";

/** Redes com publicação foto+legenda no escopo v1. */
export const SUPPORTED_SOCIAL_NETWORKS_V1 = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Pinterest",
] as const;

/** Roadmap pós-vídeo. */
export const SUPPORTED_SOCIAL_NETWORKS_VIDEO_ROADMAP = [
  "TikTok",
  "YouTube",
  "YouTube Shorts",
] as const;

/** Redes sociais suportadas pelo produto. */
export const SUPPORTED_SOCIAL_NETWORKS = [
  ...SUPPORTED_SOCIAL_NETWORKS_V1,
  ...SUPPORTED_SOCIAL_NETWORKS_VIDEO_ROADMAP,
] as const;

export const SUPPORTED_SOCIAL_NETWORKS_LABEL =
  "Instagram, Facebook, LinkedIn e Pinterest (TikTok, YouTube e Shorts em breve com suporte a vídeo)";

/** Mensagens reutilizáveis — publicação e conexão. */
export const MSG_CONNECT_SOCIAL_TO_SCHEDULE =
  "Conecte as redes sociais ou use o modo simulação para agendar.";
export const MSG_CONNECT_SOCIAL_TO_CONFIRM =
  "Conecte as redes sociais ou use o modo simulação para confirmar.";
export const MSG_SOCIAL_CONNECTED = "Redes sociais conectadas!";
export const MSG_SOCIAL_CAPTION_LIMIT =
  "Algumas redes sociais (ex.: Instagram) limitam a legenda completa a";
export const MSG_SOCIAL_PREVIEW = "Preview nas redes sociais";
export const MSG_VIEW_ON_NETWORK = "Ver publicação";

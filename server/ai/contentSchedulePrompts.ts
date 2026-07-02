import type { BrandGemConfig } from "./brandContext";
import {
  buildBrandVoiceBlock,
  buildCampaignContextBlock,
} from "./brandContext";

export type ContentScheduleGenerateOptions = {
  postCount: number;
  storyCount: number;
  startDate: string;
  extraInstructions?: string;
};

const STORY_FORMATS = [
  "Enquete",
  "Bastidores",
  "Dica Rápida",
  "Interação",
  "Tutorial",
  "Lembrança",
  "Alerta",
  "Educativo",
  "Benefício",
  "Convite",
];

const BRIEFING_LIMIT = 2000;
const EXTRA_LIMIT = 800;

const COPY_QUALITY_RULES = `
QUALIDADE DE COPY (obrigatório):
- Headline: curta, específica, com dor ou benefício concreto. Evite clichês ("solução completa", "inove seu negócio").
- Frase de apoio (subtitle): 10-18 palavras, explicativa, complementa a headline sem repetir.
- CTA: varie formatos entre itens (pergunta, convite, comentário, diagnóstico, ação direta). Evite repetir a mesma CTA.
- Alterne ângulos: dor, benefício, prova, bastidor, objeção, educação.
`;

const BRIEFING_ADHERENCE = `
ADERÊNCIA AO BRIEFING (prioridade máxima):
- O BRIEFING DO CLIENTE prevalece sobre contexto genérico do Gem/campanha em caso de conflito.
- Extraia temas/pedidos do briefing e cubra cada tema relevante em pelo menos 1 item.
- NÃO invente produtos, campanhas ou temas ausentes do briefing.
- Se o briefing pedir quantidades (ex.: "3 posts sobre X"), respeite na distribuição.
`;

const POST_RULES = `
REGRAS — POSTS DE ARTE (section: "posts"):
- postType: "Arte Única"
- headline: gancho principal na arte (curto)
- subtitle: frase de apoio visual na arte (10-18 palavras)
- cta: pergunta ou chamada para ação
- legenda: corpo completo do feed (até 6 linhas curtas)
- hashtags: use footer do Gem quando aplicável
- imagePrompt: instrução visual para designer/IA de imagem (composição 4:5 ou quadrado, hierarquia de texto na arte, paleta da marca). NÃO repita a legenda inteira.
`;

const STORY_RULES = `
REGRAS — STORIES (section: "stories"):
- postType: alternar entre ${STORY_FORMATS.join(", ")}
- headline: texto principal na tela (curto)
- subtitle: complemento na arte (10-18 palavras)
- cta: pergunta, enquete ou ação na story
- legenda: texto de apoio CURTO na tela (1-3 linhas). NÃO é legenda de feed.
- hashtags: DEIXE VAZIO (stories não usam hashtag)
- storyExtras: enquetes com pollOptions [A, B] e/ou onScreenText quando interativo
- imagePrompt: frame 9:16, texto na tela, safe zones, elementos interativos se enquete. Sem hashtags nem legenda de feed.
`;

function compactBrief(clientBrief: string): string {
  return (clientBrief.trim() || "Conteúdo mensal alinhado à marca.")
    .slice(0, BRIEFING_LIMIT)
    .trim();
}

function extraBlock(extraInstructions?: string): string {
  const trimmed = extraInstructions?.trim();
  if (!trimmed) return "";
  return `\nTEMAS OBRIGATÓRIOS / INSTRUÇÕES EXTRAS:\n${trimmed.slice(0, EXTRA_LIMIT)}`;
}

export function buildContentScheduleTask(
  gem: BrandGemConfig,
  clientBrief: string,
  options: ContentScheduleGenerateOptions
): string {
  const campaign = buildCampaignContextBlock(gem);
  const voice = buildBrandVoiceBlock(gem);
  const briefText = compactBrief(clientBrief);

  return `${voice}

${campaign}

TAREFA: Gerar um CRONOGRAMA DE CONTEÚDO MENSAL para redes sociais.

BRIEFING DO CLIENTE (siga estritamente):
---
${briefText}
---
${BRIEFING_ADHERENCE}
${extraBlock(options.extraInstructions)}

PARÂMETROS:
- ${options.postCount} posts de arte (section "posts")
- ${options.storyCount} stories (section "stories")
- Data de início: ${options.startDate}
- Distribua suggestedDate (DD/MM) ao longo do mês
- Idioma e tom: conforme GEM INSTRUCTIONS

${COPY_QUALITY_RULES}
${POST_RULES}
${STORY_RULES}

ESTRUTURA JSON de cada item:
name, section, postType, headline, subtitle, cta, legenda, hashtags, suggestedDate, imagePrompt, storyExtras (stories interativos).

REGRAS GERAIS:
- Varie temas entre itens; não repita headlines.
- Posts: valor, dor e solução da marca.
- Stories: educação, interação e bastidores.`;
}

export function buildContentScheduleRefineTask(
  gem: BrandGemConfig,
  existingItem: Record<string, unknown>,
  refineInstruction: string
): string {
  const voice = buildBrandVoiceBlock(gem);
  const section = existingItem.section === "stories" ? "stories" : "posts";
  const sectionRules = section === "stories" ? STORY_RULES : POST_RULES;
  const compactItem = JSON.stringify(existingItem);
  return `${voice}

TAREFA: Refinar UM item do cronograma de conteúdo conforme instrução do usuário.

${COPY_QUALITY_RULES}
${sectionRules}

ITEM ATUAL (JSON):
${compactItem.length > 1800 ? `${compactItem.slice(0, 1800)}...` : compactItem}

INSTRUÇÃO DE REFINAMENTO:
${refineInstruction.trim()}

Retorne o item refinado mantendo section e estrutura (incluindo imagePrompt).`;
}

export function buildContentScheduleResultInstructions(): string {
  return `Retorne JSON com array "items". Cada item:
name, section ("posts"|"stories"), postType, headline, subtitle, cta, legenda, hashtags, suggestedDate (DD/MM), imagePrompt (string).
Stories: hashtags vazio; storyExtras { pollOptions?, onScreenText? } quando interativo.
Posts: legenda completa + hashtags.
Sem texto fora do JSON.`;
}

export type ContentScheduleExistingItemSummary = {
  name: string;
  headline: string;
  scheduledDate?: string;
};

export function buildContentScheduleSingleItemTask(
  gem: BrandGemConfig,
  clientBrief: string,
  section: "posts" | "stories",
  options: {
    startDate: string;
    extraInstructions?: string;
    itemInstruction?: string;
    existingItems?: ContentScheduleExistingItemSummary[];
  }
): string {
  const campaign = buildCampaignContextBlock(gem);
  const voice = buildBrandVoiceBlock(gem);
  const briefText = compactBrief(clientBrief);
  const itemHint = options.itemInstruction?.trim()
    ? `\nTEMA DESTE ITEM:\n${options.itemInstruction.trim().slice(0, 400)}`
    : "";
  const existing =
    options.existingItems && options.existingItems.length > 0
      ? `\nITENS JÁ NO CRONOGRAMA (não repita tema/headline):\n${options.existingItems
          .slice(0, 20)
          .map(
            (i) =>
              `- ${i.name}${i.scheduledDate ? ` (${i.scheduledDate})` : ""}: ${i.headline.slice(0, 80)}`
          )
          .join("\n")}`
      : "";

  const sectionLabel = section === "posts" ? "POST DE ARTE" : "STORY";
  const sectionRules = section === "posts" ? POST_RULES : STORY_RULES;

  return `${voice}

${campaign}

TAREFA: Criar UM ÚNICO item (${sectionLabel}) para o cronograma de conteúdo mensal.

BRIEFING DO CLIENTE (siga estritamente):
---
${briefText}
---
${BRIEFING_ADHERENCE}
${extraBlock(options.extraInstructions)}${itemHint}${existing}

PARÂMETROS:
- section: "${section}"
- Data de início: ${options.startDate}
- suggestedDate em DD/MM

${COPY_QUALITY_RULES}
${sectionRules}

Retorne JSON com array "items" contendo EXATAMENTE 1 item.`;
}

export function buildContentScheduleRefineResultInstructions(): string {
  return `Retorne JSON com objeto "item" (um único item refinado):
name, section ("posts"|"stories"), postType, headline, subtitle, cta, legenda, hashtags, suggestedDate (DD/MM), imagePrompt (string).
Stories: hashtags vazio; storyExtras { pollOptions?, onScreenText? } quando interativo.
Sem texto fora do JSON.`;
}

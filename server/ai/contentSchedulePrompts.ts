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

export function buildContentScheduleTask(
  gem: BrandGemConfig,
  clientBrief: string,
  options: ContentScheduleGenerateOptions
): string {
  const campaign = buildCampaignContextBlock(gem);
  const voice = buildBrandVoiceBlock(gem);
  const extra = options.extraInstructions?.trim()
    ? `\nINSTRUÇÕES EXTRAS DO USUÁRIO:\n${options.extraInstructions.trim()}`
    : "";

  return `${voice}

${campaign}

TAREFA: Gerar um CRONOGRAMA DE CONTEÚDO MENSAL para redes sociais (Instagram).

BRIEFING / DIRECIONAMENTO DO CLIENTE:
---
${clientBrief.trim() || "Conteúdo mensal alinhado à marca e aos produtos/serviços do cliente."}
---

PARÂMETROS:
- ${options.postCount} posts de arte (seção "posts") — formatos: Arte Única
- ${options.storyCount} stories (seção "stories") — alternar formatos: ${STORY_FORMATS.join(", ")}
- Data de início do mês: ${options.startDate}
- Distribua datas sugeridas (suggestedDate) ao longo do mês em formato DD/MM
- Idioma e tom: conforme GEM INSTRUCTIONS
${extra}

ESTRUTURA DE CADA ITEM (obrigatório):
- name: identificador (ex: "POST 1", "STORY 3")
- section: "posts" ou "stories"
- postType: formato (ex: "Arte Única", "Enquete", "Bastidores")
- headline: gancho principal, curto e impactante
- subtitle: frase de apoio (complemento visual/copy)
- cta: pergunta ou chamada para ação
- legenda: corpo completo do post (máximo 6 linhas curtas para posts; stories podem ser mais diretos)
- hashtags: hashtags relevantes (use as do GEM footer quando aplicável)
- suggestedDate: DD/MM
- storyExtras (apenas stories interativos): pollOptions [opção A, opção B] e/ou onScreenText

REGRAS:
- Varie temas, produtos e ângulos entre os itens
- Não repita headlines
- Posts focam em valor, dor do cliente e solução da marca
- Stories alternam educação, interação e bastidores
- Hashtags consistentes com a marca`;
}

export function buildContentScheduleRefineTask(
  gem: BrandGemConfig,
  existingItem: Record<string, unknown>,
  refineInstruction: string
): string {
  const voice = buildBrandVoiceBlock(gem);
  return `${voice}

TAREFA: Refinar UM item do cronograma de conteúdo conforme instrução do usuário.

ITEM ATUAL (JSON):
${JSON.stringify(existingItem, null, 2)}

INSTRUÇÃO DE REFINAMENTO:
${refineInstruction.trim()}

Retorne o item refinado com a mesma estrutura (name, section, postType, headline, subtitle, cta, legenda, hashtags, suggestedDate, storyExtras se aplicável).`;
}

export function buildContentScheduleResultInstructions(): string {
  return `Retorne JSON com array "items". Cada item deve ter:
name, section ("posts"|"stories"), postType, headline, subtitle, cta, legenda, hashtags, suggestedDate (DD/MM).
Stories com enquete: inclua storyExtras { pollOptions: ["...", "..."], onScreenText?: "..." }.
Sem texto fora do JSON.`;
}

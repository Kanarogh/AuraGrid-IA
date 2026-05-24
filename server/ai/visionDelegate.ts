import { hasGeminiKey, hasGroqKey } from "./config.ts";
import { geminiProvider } from "./geminiProvider.ts";
import { groqProvider } from "./groqProvider.ts";
import type { AiProvider, AiProviderId } from "./types.ts";

/** Provedor com visão para operações que exigem imagem (DeepSeek é só texto). */
export function getVisionDelegateProvider(): AiProvider | null {
  if (hasGroqKey()) return groqProvider;
  if (hasGeminiKey()) return geminiProvider;
  return null;
}

export function getVisionDelegateId(): AiProviderId | null {
  if (hasGroqKey()) return "groq";
  if (hasGeminiKey()) return "gemini";
  return null;
}

export function requireVisionDelegate(operationLabel: string): AiProvider {
  const delegate = getVisionDelegateProvider();
  if (!delegate) {
    throw new Error(
      `DeepSeek não analisa imagens (${operationLabel}). ` +
        `Configure GROQ_API_KEY ou GEMINI_API_KEY no .env — você pode manter AI_PROVIDER=deepseek para refinamento de texto.`
    );
  }
  return delegate;
}

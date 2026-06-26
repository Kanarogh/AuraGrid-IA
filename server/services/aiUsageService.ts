import { and, eq, gte } from "drizzle-orm";
import { getUserAiContext } from "../ai/userAiContext";
import { estimateGeminiCostMicros } from "../ai/geminiPricing";
import { getDb, isDatabaseConfigured } from "../db/client";
import { aiUsageEvents, aiUsageLimits } from "../db/schema";

type ParsedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiUsageWindow = "rolling_30d";

export type AiUsageSummaryRow = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  calls: number;
  tokenLimit: number | null;
  tokenRemaining: number | null;
  costLimitMicros: number | null;
  costRemainingMicros: number | null;
};

export type AiUsageSummary = {
  byModel: AiUsageSummaryRow[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
    calls: number;
  };
  internalLimit: {
    tokenLimit: number | null;
    tokenRemaining: number | null;
    costLimitMicros: number | null;
    costRemainingMicros: number | null;
    source: "default" | "override";
  };
};

function clampNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return 0;
}

function parseEnvLimit(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function parseGeminiUsageMetadata(raw: unknown): ParsedUsage {
  const usage = (raw ?? {}) as Record<string, unknown>;
  const promptTokenCount = clampNumber(usage.promptTokenCount);
  const candidatesTokenCount = clampNumber(usage.candidatesTokenCount);
  const thoughtsTokenCount = clampNumber(usage.thoughtsTokenCount);
  const totalTokenCount = clampNumber(usage.totalTokenCount);
  const outputTokens = Math.max(candidatesTokenCount, candidatesTokenCount + thoughtsTokenCount);
  const inputTokens = promptTokenCount;
  const fallbackTotal = inputTokens + outputTokens;
  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokenCount > 0 ? totalTokenCount : fallbackTotal,
  };
}

type RecordAiUsageInput = {
  operation: string;
  provider: string;
  model: string;
  usageMetadata: unknown;
  userId?: string | null;
  clientId?: string | null;
};

export async function recordAiUsageEvent(input: RecordAiUsageInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const usage = parseGeminiUsageMetadata(input.usageMetadata);
  if (usage.totalTokens <= 0) return;

  const ctx = getUserAiContext();
  const userId = input.userId ?? ctx?.userId ?? null;
  const clientId = input.clientId ?? ctx?.clientId ?? null;

  const estimatedCostMicros =
    input.provider === "gemini"
      ? estimateGeminiCostMicros(input.model, usage.inputTokens, usage.outputTokens)
      : 0;

  const db = getDb();
  await db.insert(aiUsageEvents).values({
    userId,
    clientId,
    operation: input.operation,
    provider: input.provider,
    model: input.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostMicros,
  });
}

type SummaryInput = {
  userId: string;
  clientId: string;
  window?: AiUsageWindow;
};

function getWindowStart(window: AiUsageWindow): Date {
  const now = Date.now();
  switch (window) {
    case "rolling_30d":
    default:
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

function getDefaultLimits() {
  return {
    tokenLimit: parseEnvLimit("AI_USAGE_DEFAULT_MONTHLY_TOKEN_LIMIT"),
    costLimitMicros: parseEnvLimit("AI_USAGE_DEFAULT_MONTHLY_USD_LIMIT")
      ? Math.round((parseEnvLimit("AI_USAGE_DEFAULT_MONTHLY_USD_LIMIT") ?? 0) * 1_000_000)
      : null,
  };
}

export async function getAiUsageSummary(input: SummaryInput): Promise<AiUsageSummary> {
  const window = input.window ?? "rolling_30d";
  const from = getWindowStart(window);
  const db = getDb();

  const rows = await db
    .select()
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.userId, input.userId),
        eq(aiUsageEvents.clientId, input.clientId),
        gte(aiUsageEvents.createdAt, from)
      )
    );

  const byModelMap = new Map<string, AiUsageSummaryRow>();
  for (const row of rows) {
    const base =
      byModelMap.get(row.model) ??
      ({
        model: row.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostMicros: 0,
        calls: 0,
        tokenLimit: null,
        tokenRemaining: null,
        costLimitMicros: null,
        costRemainingMicros: null,
      } as AiUsageSummaryRow);

    base.inputTokens += row.inputTokens;
    base.outputTokens += row.outputTokens;
    base.totalTokens += row.totalTokens;
    base.estimatedCostMicros += row.estimatedCostMicros;
    base.calls += 1;
    byModelMap.set(row.model, base);
  }

  const totals = Array.from(byModelMap.values()).reduce(
    (acc, row) => {
      acc.inputTokens += row.inputTokens;
      acc.outputTokens += row.outputTokens;
      acc.totalTokens += row.totalTokens;
      acc.estimatedCostMicros += row.estimatedCostMicros;
      acc.calls += row.calls;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostMicros: 0,
      calls: 0,
    }
  );

  const defaults = getDefaultLimits();
  const [overrideGlobal] = await db
    .select()
    .from(aiUsageLimits)
    .where(
      and(
        eq(aiUsageLimits.userId, input.userId),
        eq(aiUsageLimits.clientId, input.clientId),
        eq(aiUsageLimits.window, window),
        eq(aiUsageLimits.model, "*")
      )
    )
    .limit(1);

  const source = overrideGlobal ? "override" : "default";
  const globalTokenLimit = overrideGlobal?.tokenLimit ?? defaults.tokenLimit;
  const globalCostLimitMicros = overrideGlobal?.costLimitMicros ?? defaults.costLimitMicros;

  const byModel = Array.from(byModelMap.values())
    .map((row) => {
      const tokenLimit = globalTokenLimit;
      const costLimitMicros = globalCostLimitMicros;
      return {
        ...row,
        tokenLimit,
        tokenRemaining: tokenLimit == null ? null : Math.max(0, tokenLimit - row.totalTokens),
        costLimitMicros,
        costRemainingMicros:
          costLimitMicros == null ? null : Math.max(0, costLimitMicros - row.estimatedCostMicros),
      };
    })
    .sort((a, b) => b.estimatedCostMicros - a.estimatedCostMicros);

  return {
    byModel,
    totals,
    internalLimit: {
      tokenLimit: globalTokenLimit,
      tokenRemaining: globalTokenLimit == null ? null : Math.max(0, globalTokenLimit - totals.totalTokens),
      costLimitMicros: globalCostLimitMicros,
      costRemainingMicros:
        globalCostLimitMicros == null
          ? null
          : Math.max(0, globalCostLimitMicros - totals.estimatedCostMicros),
      source,
    },
  };
}

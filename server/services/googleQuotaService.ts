export type GoogleQuotaSnapshot = {
  status: "ok" | "unavailable" | "error";
  message: string;
  metric?: string;
  limit?: number | null;
  used?: number | null;
  remaining?: number | null;
};

type QuotaBucket = {
  effectiveLimit?: string;
  defaultLimit?: string;
};

type ConsumerQuotaLimit = {
  name?: string;
  quotaBuckets?: QuotaBucket[];
};

type ConsumerQuotaMetric = {
  metric?: string;
  consumerQuotaLimits?: ConsumerQuotaLimit[];
};

function parseMaybeNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function getGoogleQuotaSnapshot(): Promise<GoogleQuotaSnapshot> {
  const projectId = process.env.GOOGLE_QUOTA_PROJECT_ID?.trim();
  const accessToken = process.env.GOOGLE_QUOTA_ACCESS_TOKEN?.trim();
  const metricFilter = process.env.GOOGLE_QUOTA_METRIC?.trim().toLowerCase();

  if (!projectId || !accessToken) {
    return {
      status: "unavailable",
      message: "Credenciais de quota Google não configuradas.",
    };
  }

  try {
    const url =
      `https://serviceusage.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
      "/services/generativelanguage.googleapis.com/consumerQuotaMetrics?view=FULL";

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `Falha ao consultar quota Google (${res.status}).`,
      };
    }

    const data = (await res.json()) as { consumerQuotaMetrics?: ConsumerQuotaMetric[] };
    const metrics = Array.isArray(data.consumerQuotaMetrics) ? data.consumerQuotaMetrics : [];
    const selected =
      metrics.find((m) =>
        metricFilter ? (m.metric ?? "").toLowerCase().includes(metricFilter) : true
      ) ?? null;

    if (!selected) {
      return {
        status: "unavailable",
        message: "Métrica de quota não encontrada no projeto.",
      };
    }

    const limits = Array.isArray(selected.consumerQuotaLimits) ? selected.consumerQuotaLimits : [];
    let bestLimit: number | null = null;
    for (const limit of limits) {
      const buckets = Array.isArray(limit.quotaBuckets) ? limit.quotaBuckets : [];
      for (const bucket of buckets) {
        const effective = parseMaybeNumber(bucket.effectiveLimit);
        const fallback = parseMaybeNumber(bucket.defaultLimit);
        const value = effective ?? fallback;
        if (value == null) continue;
        bestLimit = bestLimit == null ? value : Math.max(bestLimit, value);
      }
    }

    if (bestLimit == null) {
      return {
        status: "unavailable",
        message: "Quota Google disponível, mas sem limite numérico legível.",
        metric: selected.metric,
      };
    }

    return {
      status: "ok",
      message: "Quota Google consultada (uso em tempo real pode variar por métrica).",
      metric: selected.metric,
      limit: bestLimit,
      used: null,
      remaining: null,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

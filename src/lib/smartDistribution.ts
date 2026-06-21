import { POST_COUNT } from "./planningConstants";

export type MaxPostsPerDay = 1 | 2 | 3;
export type SparseStrategy = "sequential" | "spread";

export type SmartDistributionOptions = {
  maxPostsPerDay: MaxPostsPerDay;
  denseDaysCount: number;
  sparseStrategy: SparseStrategy;
  totalDays?: number;
};

export type DistributionPrefs = SmartDistributionOptions & {
  useAutoDenseDays?: boolean;
};

export type DistributionPreview = {
  postsPerDay: number[];
  totalSlots: number;
  imageCount: number;
  summaryLines: string[];
  overflowCount: number;
  capacity: number;
};

export const DEFAULT_DISTRIBUTION_PREFS: DistributionPrefs = {
  maxPostsPerDay: 3,
  denseDaysCount: 3,
  sparseStrategy: "sequential",
  useAutoDenseDays: true,
};

export function clampDenseDaysCount(value: number, totalDays = POST_COUNT): number {
  return Math.max(1, Math.min(totalDays, Math.round(value)));
}

/** Sugere quantos primeiros dias aceitam múltiplos posts quando N > totalDays. */
export function suggestDenseDaysCount(
  imageCount: number,
  maxPostsPerDay: MaxPostsPerDay,
  totalDays = POST_COUNT
): number {
  if (imageCount <= totalDays || maxPostsPerDay <= 1) return 1;
  const excess = imageCount - totalDays;
  const extraPerDenseDay = maxPostsPerDay - 1;
  return clampDenseDaysCount(Math.ceil(excess / extraPerDenseDay), totalDays);
}

export function resolveDistributionOptions(
  imageCount: number,
  prefs: DistributionPrefs,
  totalDays = POST_COUNT
): SmartDistributionOptions {
  const denseDaysCount = prefs.useAutoDenseDays
    ? suggestDenseDaysCount(imageCount, prefs.maxPostsPerDay, totalDays)
    : clampDenseDaysCount(prefs.denseDaysCount, totalDays);

  return {
    maxPostsPerDay: prefs.maxPostsPerDay,
    denseDaysCount,
    sparseStrategy: prefs.sparseStrategy,
    totalDays,
  };
}

function computeSpreadPostsPerDay(imageCount: number, totalDays: number): number[] {
  const postsPerDay = Array(totalDays).fill(0);
  if (imageCount <= 0) return postsPerDay;

  if (imageCount === 1) {
    postsPerDay[0] = 1;
    return postsPerDay;
  }

  for (let i = 0; i < imageCount; i++) {
    const dayIndex = Math.min(
      totalDays - 1,
      Math.round((i * (totalDays - 1)) / (imageCount - 1))
    );
    postsPerDay[dayIndex] += 1;
  }
  return postsPerDay;
}

function computeSequentialPostsPerDay(imageCount: number, totalDays: number): number[] {
  const postsPerDay = Array(totalDays).fill(0);
  for (let i = 0; i < Math.min(imageCount, totalDays); i++) {
    postsPerDay[i] = 1;
  }
  return postsPerDay;
}

function distributeExcess(
  postsPerDay: number[],
  excess: number,
  denseDaysCount: number,
  maxPostsPerDay: MaxPostsPerDay
): number {
  let remaining = excess;
  let denseDays = clampDenseDaysCount(denseDaysCount, postsPerDay.length);

  while (remaining > 0 && denseDays <= postsPerDay.length) {
    let placedThisPass = 0;
    for (let d = 0; d < denseDays && remaining > 0; d++) {
      const space = maxPostsPerDay - postsPerDay[d];
      if (space <= 0) continue;
      const add = Math.min(space, remaining);
      postsPerDay[d] += add;
      remaining -= add;
      placedThisPass += add;
    }
    if (placedThisPass === 0) break;
    if (remaining > 0 && denseDays < postsPerDay.length) {
      denseDays = Math.min(postsPerDay.length, denseDays + 1);
    } else {
      break;
    }
  }

  let cycle = 0;
  while (remaining > 0) {
    postsPerDay[cycle % postsPerDay.length] += 1;
    remaining -= 1;
    cycle += 1;
  }

  return remaining;
}

export function computePostsPerDay(
  imageCount: number,
  options: SmartDistributionOptions
): number[] {
  const totalDays = options.totalDays ?? POST_COUNT;
  const N = Math.max(0, imageCount);

  if (N === 0) return Array(totalDays).fill(0);

  if (N < totalDays) {
    return options.sparseStrategy === "spread"
      ? computeSpreadPostsPerDay(N, totalDays)
      : computeSequentialPostsPerDay(N, totalDays);
  }

  const postsPerDay = Array(totalDays).fill(1);
  const excess = N - totalDays;
  if (excess > 0) {
    distributeExcess(
      postsPerDay,
      excess,
      options.denseDaysCount,
      options.maxPostsPerDay
    );
  }
  return postsPerDay;
}

export function distributionCapacity(
  options: SmartDistributionOptions,
  totalDays = POST_COUNT
): number {
  const dense = clampDenseDaysCount(options.denseDaysCount, totalDays);
  const sparseDays = totalDays - dense;
  return sparseDays * 1 + dense * options.maxPostsPerDay;
}

function formatDenseRange(postsPerDay: number[], maxPostsPerDay: MaxPostsPerDay): string {
  let lastDense = 0;
  for (let i = 0; i < postsPerDay.length; i++) {
    if (postsPerDay[i] > 1) lastDense = i;
  }
  if (lastDense === 0 && postsPerDay[0] <= 1) {
    return `até ${maxPostsPerDay} posts/dia nos primeiros dias configurados`;
  }
  const start = 1;
  const end = lastDense + 1;
  const maxInRange = Math.max(...postsPerDay.slice(0, lastDense + 1));
  if (start === end) {
    return `Dia ${start}: até ${maxInRange} posts`;
  }
  return `Dias ${start}–${end}: até ${maxInRange} posts/dia`;
}

export function buildDistributionPreview(
  imageCount: number,
  prefs: DistributionPrefs,
  totalDays = POST_COUNT
): DistributionPreview {
  const options = resolveDistributionOptions(imageCount, prefs, totalDays);
  const postsPerDay = computePostsPerDay(imageCount, options);
  const totalSlots = postsPerDay.reduce((a, b) => a + b, 0);
  const capacity = distributionCapacity(options, totalDays);
  const overflowCount = Math.max(0, imageCount - totalSlots);
  const summaryLines: string[] = [];

  if (imageCount === 0) {
    summaryLines.push("Nenhum look com foto para distribuir.");
    return { postsPerDay, totalSlots, imageCount, summaryLines, overflowCount, capacity };
  }

  const daysWithPosts = postsPerDay.filter((c) => c > 0).length;
  const multiDays = postsPerDay.filter((c) => c > 1).length;

  summaryLines.push(
    `${imageCount} look${imageCount === 1 ? "" : "s"} → ${totalSlots} slot${totalSlots === 1 ? "" : "s"} em ${daysWithPosts} dia${daysWithPosts === 1 ? "" : "s"}`
  );

  if (imageCount < totalDays) {
    summaryLines.push(
      options.sparseStrategy === "sequential"
        ? `Sequencial: dias 1–${imageCount} com 1 look; dias ${imageCount + 1}–${totalDays} vazios.`
        : `Espalhado: looks distribuídos uniformemente nos ${totalDays} dias.`
    );
  } else if (multiDays > 0) {
    summaryLines.push(formatDenseRange(postsPerDay, options.maxPostsPerDay));
    const singleStart = postsPerDay.findIndex((c, i) => c === 1 && i > 0 && postsPerDay[i - 1] > 1);
    if (singleStart >= 0) {
      summaryLines.push(`Demais dias: 1 post por dia (máx. ${options.maxPostsPerDay} nos dias densos).`);
    }
  } else {
    summaryLines.push(`1 look por dia nos ${totalDays} dias.`);
  }

  if (options.maxPostsPerDay > 1 && imageCount >= totalDays) {
    summaryLines.push(
      `Regra: máx. ${options.maxPostsPerDay} posts/dia · janela densa: ${options.denseDaysCount} dia${options.denseDaysCount === 1 ? "" : "s"}`
    );
  }

  if (overflowCount > 0) {
    summaryLines.push(
      `Atenção: ${overflowCount} look${overflowCount === 1 ? "" : "s"} excede${overflowCount === 1 ? "" : "m"} a capacidade (${capacity}). Ajuste dias densos ou máx./dia.`
    );
  }

  return { postsPerDay, totalSlots, imageCount, summaryLines, overflowCount, capacity };
}

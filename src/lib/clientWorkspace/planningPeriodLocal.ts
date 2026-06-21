import { normalizeCaptionGenerationParams } from "../captionParams";
import { recalculatePostDates } from "../dates";
import {
  DEFAULT_START_DATE,
  createDefaultPlanningPeriod,
  periodLabelFromDate,
  type PlanningPeriod,
} from "../planningConstants";
import {
  createDefaultCanvaPages,
  createEmptyPosts,
  createEmptyWorkspace,
} from "./factory";
import type { ClientMeta, ClientWorkspace } from "./types";

export type PeriodSnapshot = {
  posts: ClientWorkspace["posts"];
  catalog: ClientWorkspace["catalog"];
  canva: ClientWorkspace["canva"];
  startDate: string;
  campaignContext: string;
};

function snapshotFromWorkspace(ws: ClientWorkspace): PeriodSnapshot {
  return {
    posts: ws.posts,
    catalog: ws.catalog,
    canva: ws.canva,
    startDate: ws.startDate,
    campaignContext: ws.brandGem.campaignContext ?? "",
  };
}

function applySnapshot(ws: ClientWorkspace, snapshot: PeriodSnapshot): ClientWorkspace {
  return {
    ...ws,
    posts: snapshot.posts,
    catalog: snapshot.catalog,
    canva: snapshot.canva,
    startDate: snapshot.startDate,
    brandGem: {
      ...ws.brandGem,
      campaignContext: snapshot.campaignContext,
    },
  };
}

export function persistActivePeriodSnapshot(ws: ClientWorkspace): ClientWorkspace {
  const snapshots = { ...(ws.periodSnapshots ?? {}) };
  snapshots[ws.activePlanningPeriodId] = snapshotFromWorkspace(ws);
  return { ...ws, periodSnapshots: snapshots };
}

export function switchLocalPlanningPeriod(
  ws: ClientWorkspace,
  periodId: string
): ClientWorkspace {
  const period = ws.planningPeriods.find((p) => p.id === periodId);
  if (!period) return ws;

  let next = persistActivePeriodSnapshot(ws);
  const snapshot = next.periodSnapshots?.[periodId];
  if (snapshot) {
    next = applySnapshot(next, snapshot);
  } else if (period.status === "active") {
    // período ativo sem snapshot — mantém dados atuais
  } else {
    const empty = createEmptyWorkspace({ id: "", name: "" } as ClientMeta);
    next = applySnapshot(next, {
      posts: recalculatePostDates(period.startDate, createEmptyPosts()),
      catalog: [],
      canva: {
        pages: createDefaultCanvaPages(),
        activePageId: "page_4",
        autoSync: true,
        reversed: true,
        gridFormat: empty.canva.gridFormat,
        gridMaxWidth: empty.canva.gridMaxWidth,
      },
      startDate: period.startDate,
      campaignContext: period.campaignContext ?? "",
    });
  }

  return {
    ...next,
    activePlanningPeriodId: periodId,
    isReadOnly: period.status === "archived",
    brandGem: {
      ...next.brandGem,
      campaignContext: period.campaignContext ?? next.brandGem.campaignContext ?? "",
    },
    startDate: period.startDate,
  };
}

function cloneSnapshot(snapshot: PeriodSnapshot): PeriodSnapshot {
  return {
    posts: snapshot.posts.map((p) => ({ ...p, id: `${p.id}_dup_${Date.now()}` })),
    catalog: snapshot.catalog.map((c) => ({
      ...c,
      id: `${c.id}_dup_${Date.now()}`,
    })),
    canva: {
      ...snapshot.canva,
      pages: snapshot.canva.pages.map((page) => ({
        ...page,
        slots: page.slots.map((slot) => ({ ...slot })),
      })),
    },
    startDate: snapshot.startDate,
    campaignContext: snapshot.campaignContext,
  };
}

export function createLocalPlanningPeriod(
  ws: ClientWorkspace,
  meta: ClientMeta,
  options: {
    label?: string;
    startDate?: string;
    sourcePeriodId?: string;
  }
): ClientWorkspace {
  const startDate = options.startDate ?? DEFAULT_START_DATE;
  const label = options.label?.trim() || periodLabelFromDate(startDate);
  const now = new Date().toISOString();
  const newPeriodId = `${meta.id}__period_${Date.now()}`;

  let next = persistActivePeriodSnapshot(ws);
  const planningPeriods = next.planningPeriods.map((p) =>
    p.status === "active" ? { ...p, status: "archived" as const, archivedAt: now } : p
  );

  const newPeriod: PlanningPeriod = {
    id: newPeriodId,
    label,
    startDate,
    status: "active",
    campaignContext: "",
    createdAt: now,
    updatedAt: now,
  };

  let snapshot: PeriodSnapshot;
  if (options.sourcePeriodId) {
    const source =
      next.periodSnapshots?.[options.sourcePeriodId] ??
      (options.sourcePeriodId === ws.activePlanningPeriodId
        ? snapshotFromWorkspace(ws)
        : null);
    const sourceMeta = ws.planningPeriods.find((p) => p.id === options.sourcePeriodId);
    snapshot = source
      ? cloneSnapshot(source)
      : {
          posts: recalculatePostDates(startDate, createEmptyPosts()),
          catalog: [],
          canva: createEmptyWorkspace(meta).canva,
          startDate,
          campaignContext: sourceMeta?.campaignContext ?? "",
        };
    newPeriod.campaignContext = snapshot.campaignContext;
  } else {
    const empty = createEmptyWorkspace(meta);
    snapshot = {
      posts: recalculatePostDates(startDate, createEmptyPosts()),
      catalog: [],
      canva: empty.canva,
      startDate,
      campaignContext: "",
    };
  }

  const snapshots = { ...(next.periodSnapshots ?? {}), [newPeriodId]: snapshot };

  next = {
    ...applySnapshot(next, snapshot),
    activePlanningPeriodId: newPeriodId,
    planningPeriods: [newPeriod, ...planningPeriods],
    periodSnapshots: snapshots,
    isReadOnly: false,
  };

  return next;
}

export function resetLocalActivePeriod(ws: ClientWorkspace, meta: ClientMeta): ClientWorkspace {
  const empty = createEmptyWorkspace(meta);
  const snapshot: PeriodSnapshot = {
    posts: recalculatePostDates(ws.startDate, createEmptyPosts()),
    catalog: [],
    canva: empty.canva,
    startDate: ws.startDate,
    campaignContext: "",
  };
  const planningPeriods = ws.planningPeriods.map((p) =>
    p.id === ws.activePlanningPeriodId
      ? { ...p, campaignContext: "", updatedAt: new Date().toISOString() }
      : p
  );
  let next = applySnapshot(ws, snapshot);
  next = {
    ...next,
    planningPeriods,
    brandGem: {
      ...next.brandGem,
      description: "",
      instructions: "",
      campaignContext: "",
      captionParams: normalizeCaptionGenerationParams({}),
      footer: {
        structure: "",
        address: "",
        contact: "",
        hashtags: "",
        extra: "",
        customFields: [],
      },
    },
    periodSnapshots: {
      ...(ws.periodSnapshots ?? {}),
      [ws.activePlanningPeriodId]: snapshot,
    },
  };
  return next;
}

import { normalizeCaptionGenerationParams } from "../captionParams";
import { recalculatePostDates } from "../dates";
import {
  defaultPlanningStartDate,
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
import { effectiveUsesReferencesFromParts } from "../referenceWorkflow";

export type PeriodSnapshot = {
  posts: ClientWorkspace["posts"];
  catalog: ClientWorkspace["catalog"];
  canva: ClientWorkspace["canva"];
  contentSchedule: ClientWorkspace["contentSchedule"];
  startDate: string;
  campaignContext: string;
  usesReferences?: boolean | null;
};

function snapshotFromWorkspace(ws: ClientWorkspace): PeriodSnapshot {
  return {
    posts: ws.posts,
    catalog: ws.catalog,
    canva: ws.canva,
    contentSchedule: ws.contentSchedule,
    startDate: ws.startDate,
    campaignContext: ws.brandGem.campaignContext ?? "",
    usesReferences: ws.planningPeriods.find((p) => p.id === ws.activePlanningPeriodId)
      ?.usesReferences,
  };
}

function applySnapshot(ws: ClientWorkspace, snapshot: PeriodSnapshot): ClientWorkspace {
  return {
    ...ws,
    posts: snapshot.posts,
    catalog: snapshot.catalog,
    canva: snapshot.canva,
    contentSchedule: snapshot.contentSchedule ?? [],
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
      contentSchedule: [],
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
    periodEditMode: period.status === "archived" ? "view_archived" : "active",
    usesReferences: effectiveUsesReferencesFromParts(
      next.defaultUsesReferences,
      period
    ),
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
    contentSchedule: (snapshot.contentSchedule ?? []).map((item) => ({
      ...item,
      id: `${item.id}_dup_${Date.now()}`,
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
    usesReferences?: boolean | null;
  }
): ClientWorkspace {
  const startDate = options.startDate ?? defaultPlanningStartDate();
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
    usesReferences: options.usesReferences ?? null,
    createdAt: now,
    updatedAt: now,
  };

  let snapshot: PeriodSnapshot;
  if (options.sourcePeriodId) {
    const sourceMeta = ws.planningPeriods.find((p) => p.id === options.sourcePeriodId);
    if (options.usesReferences === undefined && sourceMeta) {
      newPeriod.usesReferences = sourceMeta.usesReferences ?? null;
    }
    const source =
      next.periodSnapshots?.[options.sourcePeriodId] ??
      (options.sourcePeriodId === ws.activePlanningPeriodId
        ? snapshotFromWorkspace(ws)
        : null);
    snapshot = source
      ? cloneSnapshot(source)
      : {
          posts: recalculatePostDates(startDate, createEmptyPosts()),
          catalog: [],
          contentSchedule: [],
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
      contentSchedule: [],
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
    periodEditMode: "active",
    usesReferences: effectiveUsesReferencesFromParts(next.defaultUsesReferences, newPeriod),
  };

  return next;
}

/** Visualiza roteiro arquivado sem reativar (somente leitura). */
export function viewLocalPlanningPeriod(ws: ClientWorkspace, periodId: string): ClientWorkspace {
  const next = switchLocalPlanningPeriod(ws, periodId);
  const period = next.planningPeriods.find((p) => p.id === periodId);
  if (!period || period.status !== "archived") return next;
  return { ...next, isReadOnly: true, periodEditMode: "view_archived" };
}

/** Reativa roteiro arquivado (arquiva o ativo atual). */
export function reactivateLocalPlanningPeriod(
  ws: ClientWorkspace,
  periodId: string
): ClientWorkspace {
  const period = ws.planningPeriods.find((p) => p.id === periodId);
  if (!period) return ws;

  const now = new Date().toISOString();
  let next = persistActivePeriodSnapshot(ws);
  const planningPeriods = next.planningPeriods.map((p) => {
    if (p.id === periodId) {
      return { ...p, status: "active" as const, archivedAt: undefined, updatedAt: now };
    }
    if (p.status === "active") {
      return { ...p, status: "archived" as const, archivedAt: now, updatedAt: now };
    }
    return p;
  });

  next = { ...next, planningPeriods };
  next = switchLocalPlanningPeriod(next, periodId);
  return { ...next, isReadOnly: false, periodEditMode: "active" };
}

/** Edita roteiro arquivado sem alterar qual período está ativo no cliente. */
export function editArchivedLocalPlanningPeriod(
  ws: ClientWorkspace,
  periodId: string
): ClientWorkspace {
  const period = ws.planningPeriods.find((p) => p.id === periodId);
  if (!period || period.status !== "archived") return ws;
  const next = switchLocalPlanningPeriod(ws, periodId);
  return { ...next, isReadOnly: false, periodEditMode: "edit_archived" };
}

export function resetLocalActivePeriod(ws: ClientWorkspace, meta: ClientMeta): ClientWorkspace {
  const empty = createEmptyWorkspace(meta);
  const snapshot: PeriodSnapshot = {
    posts: recalculatePostDates(ws.startDate, createEmptyPosts()),
    catalog: [],
    contentSchedule: [],
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

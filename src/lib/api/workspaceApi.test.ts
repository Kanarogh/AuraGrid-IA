import assert from "node:assert/strict";
import {
  apiWorkspaceToClientWorkspace,
  normalizeContentScheduleOptions,
  type ApiWorkspaceResponse,
} from "./workspaceApi";
import { createEmptyBrandGem } from "../brandGemDefaults";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

console.log("api/workspaceApi");

const baseDto: ApiWorkspaceResponse = {
  version: 1,
  client: {
    id: "client-a",
    name: "Cliente A",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  brandGem: createEmptyBrandGem("client-a", "Cliente A"),
  catalog: [],
  posts: [],
  contentSchedule: [],
  startDate: "2026-06-01",
  activePlanningPeriodId: "period_1",
  planningPeriods: [],
  canva: {
    pages: [],
    activePageId: "page_1",
    autoSync: true,
    reversed: true,
  },
};

test("apiWorkspaceToClientWorkspace maps contentScheduleBrief", () => {
  const ws = apiWorkspaceToClientWorkspace({
    ...baseDto,
    contentScheduleBrief: "Briefing do mês de junho",
  });
  assert.equal(ws.contentScheduleBrief, "Briefing do mês de junho");
});

test("apiWorkspaceToClientWorkspace defaults missing contentScheduleBrief to empty string", () => {
  const ws = apiWorkspaceToClientWorkspace(baseDto);
  assert.equal(ws.contentScheduleBrief, "");
});

test("normalizeContentScheduleOptions applies defaults", () => {
  assert.deepEqual(normalizeContentScheduleOptions(undefined), {
    postCount: 9,
    storyCount: 12,
    extraInstructions: "",
  });
});

test("apiWorkspaceToClientWorkspace maps contentScheduleOptions", () => {
  const ws = apiWorkspaceToClientWorkspace({
    ...baseDto,
    contentScheduleOptions: { postCount: 12, storyCount: 8, extraInstructions: "Tom direto" },
  });
  assert.deepEqual(ws.contentScheduleOptions, {
    postCount: 12,
    storyCount: 8,
    extraInstructions: "Tom direto",
  });
});

import assert from "node:assert/strict";
import { isStaleFetch } from "./publishFetchGuard";
import {
  loadPublishDrafts,
  publishDraftStorageKey,
  savePublishDrafts,
} from "./publishDraftStorage";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok: ${name}`);
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    throw err;
  }
}

test("isStaleFetch returns false when generations match", () => {
  assert.equal(isStaleFetch(3, 3), false);
});

test("isStaleFetch returns true when generation advanced", () => {
  assert.equal(isStaleFetch(2, 5), true);
});

test("publishDraftStorageKey isolates by clientId", () => {
  const period = "period_abc";
  assert.notEqual(
    publishDraftStorageKey("client-a", period),
    publishDraftStorageKey("client-b", period)
  );
});

test("loadPublishDrafts returns independent data per client", () => {
  const period = "period_shared";
  const keyA = publishDraftStorageKey("client-a", period);
  const keyB = publishDraftStorageKey("client-b", period);

  const store = new Map<string, string>();
  const session = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  const originalWindow = globalThis.window;
  const originalSession = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: session });

  try {
    savePublishDrafts("client-a", period, { post_a: "2026-06-01T10:00:00.000Z" });
    savePublishDrafts("client-b", period, { post_b: "2026-06-02T11:00:00.000Z" });

    const draftsA = loadPublishDrafts("client-a", period);
    const draftsB = loadPublishDrafts("client-b", period);

    assert.deepEqual(draftsA, { post_a: "2026-06-01T10:00:00.000Z" });
    assert.deepEqual(draftsB, { post_b: "2026-06-02T11:00:00.000Z" });
    assert.equal(store.get(keyA)?.includes("post_a"), true);
    assert.equal(store.get(keyB)?.includes("post_b"), true);
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: originalSession,
    });
  }
});

console.log("publishClientSwitch tests passed");

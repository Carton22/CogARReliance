import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadScript({ requireProgressLock = false, failFirstProgressWrite = false } = {}) {
  const source = await readFile(new URL("../scripts/google-sheets-sync.gs", import.meta.url), "utf8");
  const properties = new Map();
  const appendedRows = [];
  let lockHeld = false;
  let shouldFailProgressWrite = failFirstProgressWrite;
  const context = {
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      },
    },
    PropertiesService: {
      getDocumentProperties() {
        return {
          getProperty: (key) => properties.get(key) ?? null,
          setProperty(key, value) {
            if (requireProgressLock && !lockHeld) {
              throw new Error("progress property write was not locked");
            }
            if (shouldFailProgressWrite) {
              shouldFailProgressWrite = false;
              throw new Error("simulated property write failure");
            }
            properties.set(key, value);
          },
        };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            if (lockHeld) throw new Error("progress lock was not released");
            lockHeld = true;
          },
          releaseLock() {
            lockHeld = false;
          },
        };
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName() { return null; },
          insertSheet() {
            return {
              getRange() {
                return {
                  getValues: () => [["", "", "", "", "", "", "", ""]],
                  setValues() {},
                };
              },
              appendRow: (row) => appendedRows.push(row),
            };
          },
        };
      },
    },
  };
  vm.runInNewContext(source, context);
  return { context, properties, appendedRows };
}

const progress = {
  participantId: 7,
  planId: "shelf",
  currentStep: 5,
  totalSteps: 20,
  updatedAt: "2026-08-04T12:00:00.000Z",
};

test("stores progress without appending a research row and returns it by participant", async () => {
  const { context, appendedRows } = await loadScript();
  context.doPost({ postData: { contents: JSON.stringify({ type: "progress", progress }) } });
  assert.equal(appendedRows.length, 0);
  const response = context.doGet({ parameter: { participant: "7" } });
  assert.deepEqual(JSON.parse(response.text), { ok: true, progress });
});

test("keeps existing event posts on participant sheets", async () => {
  const { context, appendedRows } = await loadScript();
  context.doPost({ postData: { contents: JSON.stringify({ row: {
    participant_id: 7,
    plan_id: "shelf",
    plan: "Shelf assembly plan",
    task: 5,
    step_name: "Take a green piece",
    action: "AI audio",
    detail: "Take a green piece",
    event_timestamp_iso: "2026-08-04T12:00:00.000Z",
  } }) } });
  assert.equal(appendedRows.length, 1);
  assert.equal(appendedRows[0][3], 5);
});

test("returns null when a participant has no progress state", async () => {
  const { context } = await loadScript();
  const response = context.doGet({ parameter: { participant: "8" } });
  assert.deepEqual(JSON.parse(response.text), { ok: true, progress: null });
});

test("rejects invalid progress without replacing the last valid value", async () => {
  const { context } = await loadScript();
  context.doPost({ postData: { contents: JSON.stringify({ type: "progress", progress }) } });
  const invalidResponse = context.doPost({
    postData: {
      contents: JSON.stringify({
        type: "progress",
        progress: { ...progress, currentStep: 21, totalSteps: 20 },
      }),
    },
  });
  assert.deepEqual(JSON.parse(invalidResponse.text), {
    ok: false,
    error: "invalid_progress",
  });
  const response = context.doGet({ parameter: { participant: "7" } });
  assert.deepEqual(JSON.parse(response.text), { ok: true, progress });
});

test("ignores a delayed older progress write after a newer state is stored", async () => {
  const { context } = await loadScript({ requireProgressLock: true });
  const newer = {
    ...progress,
    currentStep: 0,
    updatedAt: "2026-08-04T12:00:02.000Z",
  };
  const delayedOlder = {
    ...progress,
    currentStep: 8,
    updatedAt: "2026-08-04T12:00:01.000Z",
  };

  context.doPost({ postData: { contents: JSON.stringify({ type: "progress", progress: newer }) } });
  const staleResponse = context.doPost({
    postData: { contents: JSON.stringify({ type: "progress", progress: delayedOlder }) },
  });

  assert.deepEqual(JSON.parse(staleResponse.text), { ok: true, stale: true });
  const response = context.doGet({ parameter: { participant: "7" } });
  assert.deepEqual(JSON.parse(response.text), { ok: true, progress: newer });
});

test("releases the progress lock when property storage fails", async () => {
  const { context } = await loadScript({
    requireProgressLock: true,
    failFirstProgressWrite: true,
  });
  const post = () => context.doPost({
    postData: { contents: JSON.stringify({ type: "progress", progress }) },
  });

  assert.throws(post, /simulated property write failure/);
  assert.doesNotThrow(post);
});

test("rejects a non-ISO progress timestamp without replacing stored state", async () => {
  const { context } = await loadScript();
  context.doPost({ postData: { contents: JSON.stringify({ type: "progress", progress }) } });

  const invalidResponse = context.doPost({
    postData: {
      contents: JSON.stringify({
        type: "progress",
        progress: { ...progress, currentStep: 6, updatedAt: "later" },
      }),
    },
  });

  assert.deepEqual(JSON.parse(invalidResponse.text), {
    ok: false,
    error: "invalid_progress",
  });
  const response = context.doGet({ parameter: { participant: "7" } });
  assert.deepEqual(JSON.parse(response.text), { ok: true, progress });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadScript() {
  const source = await readFile(new URL("../scripts/google-sheets-sync.gs", import.meta.url), "utf8");
  const properties = new Map();
  const appendedRows = [];
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
          setProperty: (key, value) => properties.set(key, value),
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

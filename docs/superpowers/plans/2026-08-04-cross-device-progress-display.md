# Cross-Device Progress Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal participant display whose large progress bar follows AI-audio row clicks made on an operator's separate computer.

**Architecture:** A small shared browser module validates progress state and owns the Apps Script HTTP contract. The main console publishes the active rendered row only from its existing `shouldRecord` AI-audio path, while `/progress` polls the relay once per second. Google Apps Script stores one latest-state document property per participant and leaves existing research-event sheet rows unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript/JavaScript modules, CSS Modules, Google Apps Script, Node.js built-in test runner

## Global Constraints

- Work on the existing `progress-bar` branch.
- The progress page visibly renders only one large horizontal bar and one `<current step>/<total steps>` value.
- The route is `/progress?participant=<ID>` and the participant range is 1 through 36.
- The display link navigates in the same tab; it does not set `target="_blank"`.
- Only clicks in the `AI audio` column update progress.
- Instruction-preview audio, accept/reject controls, and session audio do not update progress.
- Totals come from the active rendered rows: Sandwich 6, Shelf 20, Boba 20, Table 12.
- Poll once immediately and once per second thereafter.
- Preserve existing Google Sheets event-log headers and append behavior.
- Use the shared deployed `DEFAULT_SHEET_SYNC_URL` for cross-device progress state.
- Honor `NEXT_PUBLIC_BASE_PATH` for the progress link.
- Do not add dependencies.

---

## File Map

- Create `app/progress-sync.mjs`: shared state validation, percentage calculation, POST publisher, and GET subscriber.
- Modify `app/page.tsx`: publish progress from the recorded AI-audio path, initialize/reset plan progress, and render the display link.
- Modify `app/globals.css`: style the top-bar display link consistently with existing controls.
- Create `app/progress/page.tsx`: client polling lifecycle and the two-element participant display.
- Create `app/progress/progress.module.css`: viewport-scale bar/value styling with responsive and reduced-motion rules.
- Modify `scripts/google-sheets-sync.gs`: persist/retrieve latest progress by participant without appending event rows.
- Create `tests/progress-sync.test.mjs`: direct behavioral tests for the shared browser module.
- Create `tests/google-sheets-progress-sync.test.mjs`: execute the Apps Script in a mocked Apps Script runtime and test relay behavior.
- Create `tests/progress-display.test.mjs`: source-contract tests for main-page trigger boundaries and minimal display markup.

---

### Task 1: Shared Progress Sync Contract

**Files:**
- Create: `app/progress-sync.mjs`
- Create: `tests/progress-sync.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_SHEET_SYNC_URL: string`
- Produces: `normalizeParticipantId(value: unknown): number`
- Produces: `normalizeProgress(value: unknown): ProgressState | null`
- Produces: `progressPercentage(progress: ProgressState): number`
- Produces: `publishProgress(progress: ProgressState, fetchImpl?: typeof fetch): Promise<void>`
- Produces: `fetchProgress(participantId: number, fetchImpl?: typeof fetch): Promise<ProgressState | null>`
- `ProgressState` is a JSDoc typedef with `participantId`, `planId`, `currentStep`, `totalSteps`, and `updatedAt`.

- [ ] **Step 1: Write failing behavioral tests for normalization and percentage calculation**

Create `tests/progress-sync.test.mjs` with:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProgress,
  normalizeParticipantId,
  normalizeProgress,
  progressPercentage,
  publishProgress,
} from "../app/progress-sync.mjs";

const valid = {
  participantId: 7,
  planId: "shelf",
  currentStep: 5,
  totalSteps: 20,
  updatedAt: "2026-08-04T12:00:00.000Z",
};

test("normalizes participant IDs into the supported range", () => {
  assert.equal(normalizeParticipantId("7"), 7);
  assert.equal(normalizeParticipantId("0"), 1);
  assert.equal(normalizeParticipantId("37"), 1);
  assert.equal(normalizeParticipantId("words"), 1);
});

test("accepts valid progress and rejects malformed progress", () => {
  assert.deepEqual(normalizeProgress(valid), valid);
  assert.equal(normalizeProgress({ ...valid, currentStep: 21 }), null);
  assert.equal(normalizeProgress({ ...valid, planId: "unknown" }), null);
  assert.equal(normalizeProgress(null), null);
});

test("clamps percentage into the visual range", () => {
  assert.equal(progressPercentage(valid), 25);
  assert.equal(progressPercentage({ ...valid, currentStep: -4 }), 0);
  assert.equal(progressPercentage({ ...valid, currentStep: 99 }), 100);
  assert.equal(progressPercentage({ ...valid, totalSteps: 0 }), 0);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node --test tests/progress-sync.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `app/progress-sync.mjs`.

- [ ] **Step 3: Add failing HTTP contract tests**

Append tests that inject a fake fetch and assert real request arguments:

```js
test("publishes a typed progress payload without requiring a readable CORS response", async () => {
  const calls = [];
  await publishProgress(valid, async (...args) => {
    calls.push(args);
    return new Response(null, { status: 200 });
  });

  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.match(String(url), /script\.google\.com/);
  assert.equal(options.method, "POST");
  assert.equal(options.mode, "no-cors");
  assert.deepEqual(JSON.parse(options.body), {
    type: "progress",
    progress: valid,
  });
});

test("fetches the latest progress for one participant", async () => {
  const result = await fetchProgress(7, async (url, options) => {
    assert.equal(new URL(String(url)).searchParams.get("participant"), "7");
    assert.equal(options.cache, "no-store");
    return Response.json({ ok: true, progress: valid });
  });
  assert.deepEqual(result, valid);
});

test("distinguishes an empty valid state from a failed response", async () => {
  assert.equal(
    await fetchProgress(7, async () => Response.json({ ok: true, progress: null })),
    null,
  );
  await assert.rejects(
    fetchProgress(7, async () => new Response("bad", { status: 500 })),
    /progress request failed/i,
  );
});
```

- [ ] **Step 4: Implement the minimal shared module**

Create `app/progress-sync.mjs` with the exact allowed plan IDs and validation boundaries:

```js
export const DEFAULT_SHEET_SYNC_URL =
  "https://script.google.com/a/macros/umn.edu/s/AKfycbz_nqJuXk07t0STgh1aKmajbJ3Af7RXAnc4iPe8ddQvqh_eaOUUbOIdoTO-7OyygQS6gw/exec";

const PLAN_IDS = new Set(["sandwich", "shelf", "boba", "table"]);

/**
 * @typedef {{
 *   participantId: number,
 *   planId: "sandwich" | "shelf" | "boba" | "table",
 *   currentStep: number,
 *   totalSteps: number,
 *   updatedAt: string,
 * }} ProgressState
 */

export function normalizeParticipantId(value) {
  const participantId = Number(value);
  return Number.isInteger(participantId) && participantId >= 1 && participantId <= 36
    ? participantId
    : 1;
}

export function normalizeProgress(value) {
  if (!value || typeof value !== "object") return null;
  const candidate = value;
  if (
    !Number.isInteger(candidate.participantId) ||
    candidate.participantId < 1 ||
    candidate.participantId > 36 ||
    !PLAN_IDS.has(candidate.planId) ||
    !Number.isInteger(candidate.currentStep) ||
    !Number.isInteger(candidate.totalSteps) ||
    candidate.totalSteps < 0 ||
    candidate.currentStep < 0 ||
    candidate.currentStep > candidate.totalSteps ||
    typeof candidate.updatedAt !== "string"
  ) return null;
  return candidate;
}

export function progressPercentage(progress) {
  if (progress.totalSteps <= 0) return 0;
  const current = Math.min(Math.max(progress.currentStep, 0), progress.totalSteps);
  return (current / progress.totalSteps) * 100;
}

export async function publishProgress(progress, fetchImpl = globalThis.fetch) {
  const normalized = normalizeProgress(progress);
  if (!normalized) throw new TypeError("Invalid progress state");
  await fetchImpl(DEFAULT_SHEET_SYNC_URL, {
    method: "POST",
    mode: "no-cors",
    credentials: "include",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ type: "progress", progress: normalized }),
  });
}

export async function fetchProgress(participantId, fetchImpl = globalThis.fetch) {
  const url = new URL(DEFAULT_SHEET_SYNC_URL);
  url.searchParams.set("participant", String(normalizeParticipantId(participantId)));
  const response = await fetchImpl(url, {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Progress request failed");
  const body = await response.json();
  if (body?.ok !== true) throw new Error("Progress response was invalid");
  if (body.progress === null) return null;
  const normalized = normalizeProgress(body.progress);
  if (!normalized) throw new Error("Progress response was invalid");
  return normalized;
}
```

- [ ] **Step 5: Run the focused test and confirm all shared-contract tests pass**

Run: `node --test tests/progress-sync.test.mjs`

Expected: PASS with 6 tests and 0 failures.

- [ ] **Step 6: Commit the shared contract**

```bash
git add app/progress-sync.mjs tests/progress-sync.test.mjs
git commit -m "feat: add progress sync client"
```

---

### Task 2: Google Apps Script Progress Relay

**Files:**
- Modify: `scripts/google-sheets-sync.gs:1-59`
- Create: `tests/google-sheets-progress-sync.test.mjs`

**Interfaces:**
- Consumes: `{ type: "progress", progress: ProgressState }` POST body from Task 1.
- Produces: `progressKey(participantId): string`, scoped as `progress:P<two-digit ID>`.
- Produces: `doGet(event)` response `{ ok: true, progress: ProgressState | null }` when a participant query is present.
- Preserves: existing `{ source, row }` event POST behavior and `HEADERS` order.

- [ ] **Step 1: Write a failing Apps Script runtime test**

Create a VM harness in `tests/google-sheets-progress-sync.test.mjs` that supplies `ContentService`, `PropertiesService`, and `SpreadsheetApp`. The core assertions are:

```js
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
```

- [ ] **Step 2: Run the focused test and confirm the missing-relay failure**

Run: `node --test tests/google-sheets-progress-sync.test.mjs`

Expected: FAIL because progress POST currently appends a sheet row and `doGet` ignores the participant query.

- [ ] **Step 3: Implement validated property storage and participant GET**

Add `progressKey`, `normalizeProgress`, and `jsonResponse`; branch before spreadsheet access:

```js
function progressKey(participantId) {
  return `progress:${participantSheetName(participantId)}`;
}

function normalizeProgress(progress) {
  const participantId = Number(progress && progress.participantId);
  const currentStep = Number(progress && progress.currentStep);
  const totalSteps = Number(progress && progress.totalSteps);
  const planIds = ["sandwich", "shelf", "boba", "table"];
  if (
    !Number.isInteger(participantId) || participantId < 1 || participantId > 36 ||
    planIds.indexOf(progress.planId) === -1 ||
    !Number.isInteger(currentStep) || !Number.isInteger(totalSteps) ||
    totalSteps < 0 || currentStep < 0 || currentStep > totalSteps ||
    typeof progress.updatedAt !== "string"
  ) return null;
  return { participantId, planId: progress.planId, currentStep, totalSteps, updatedAt: progress.updatedAt };
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

At the top of `doPost`, branch before spreadsheet access, and replace `doGet` with the participant-aware version:

```js
function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  if (payload.type === "progress") {
    const progress = normalizeProgress(payload.progress);
    if (!progress) return jsonResponse({ ok: false, error: "invalid_progress" });
    PropertiesService
      .getDocumentProperties()
      .setProperty(progressKey(progress.participantId), JSON.stringify(progress));
    return jsonResponse({ ok: true });
  }

  const row = payload.row || {};
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetForParticipant(spreadsheet, row.participant_id);
  ensureHeaders(sheet);
  sheet.appendRow([
    row.participant_id || "",
    row.plan_id || "",
    row.plan || "",
    row.task || "",
    row.step_name || "",
    row.action || "",
    row.detail || "",
    row.event_timestamp_iso || "",
  ]);
  return jsonResponse({ ok: true });
}

function doGet(event) {
  const participant = event && event.parameter && event.parameter.participant;
  const participantId = Number(participant);
  if (Number.isInteger(participantId) && participantId >= 1 && participantId <= 36) {
    const stored = PropertiesService
      .getDocumentProperties()
      .getProperty(progressKey(participantId));
    return jsonResponse({ ok: true, progress: stored ? JSON.parse(stored) : null });
  }
  return jsonResponse({ ok: true, service: "cogar-study-console-sync" });
}
```

- [ ] **Step 4: Add rejection and empty-state cases, then run them green**

Append these two cases:

```js
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
```

Run: `node --test tests/google-sheets-progress-sync.test.mjs`

Expected: PASS with 4 tests and 0 failures.

- [ ] **Step 5: Run the existing sheet source-contract test**

Run: `node --test --test-name-pattern="Google Sheets event sync" tests/rendered-html.test.mjs`

Expected: PASS, confirming the existing headers and event append contract remain present.

- [ ] **Step 6: Commit the relay**

```bash
git add scripts/google-sheets-sync.gs tests/google-sheets-progress-sync.test.mjs
git commit -m "feat: relay participant progress through apps script"
```

---

### Task 3: Main Console Publisher and Display Link

**Files:**
- Modify: `app/page.tsx:3-56,619-703,821-920,970-1039`
- Modify: `app/globals.css:109-180,1058-1117`
- Create: `tests/progress-display.test.mjs`

**Interfaces:**
- Consumes: `DEFAULT_SHEET_SYNC_URL`, `publishProgress` from Task 1.
- Produces: top-bar link `${PUBLIC_BASE_PATH}/progress?participant=${participantId}`.
- Produces: `publishActiveProgress(currentStep: number): Promise<void>` using the active rendered task count.

- [ ] **Step 1: Write failing source-contract tests for trigger boundaries and link navigation**

Create `tests/progress-display.test.mjs` with:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("links the selected participant to the separate progress route in the same tab", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /href=\{`\$\{PUBLIC_BASE_PATH\}\/progress\?participant=\$\{participantId\}`\}/);
  assert.match(page, />Participant display<\/a>/);
  assert.doesNotMatch(page, /target=["']_blank["']/);
});

test("publishes progress only from recorded AI audio playback", async () => {
  const page = await readFile(pageUrl, "utf8");
  const playStart = page.indexOf("const playInstruction");
  const playEnd = page.indexOf("const markDecision", playStart);
  const playInstruction = page.slice(playStart, playEnd);
  const recordStart = playInstruction.indexOf("if (shouldRecord)");
  assert.ok(recordStart > 0);
  assert.match(playInstruction.slice(recordStart), /publishActiveProgress\(taskNumber\)/);
  assert.doesNotMatch(playInstruction.slice(0, recordStart), /publishActiveProgress/);
  assert.match(page, /optionIndex,\s*false,/);
});

test("initializes and resets the active plan at step zero", async () => {
  const page = await readFile(pageUrl, "utf8");
  const hydrationStart = page.indexOf("if (!hydrated) return;", page.indexOf("const activeState"));
  const hydrationEnd = page.indexOf("}, [activePlanIndex, hydrated, participantId]);", hydrationStart);
  assert.ok(hydrationStart > 0 && hydrationEnd > hydrationStart);
  assert.match(page.slice(hydrationStart, hydrationEnd), /currentStep:\s*0/);
  const resetStart = page.indexOf("const resetSession");
  const resetEnd = page.indexOf("const handleParticipantIdChange", resetStart);
  assert.match(page.slice(resetStart, resetEnd), /publishActiveProgress\(0\)/);
});
```

- [ ] **Step 2: Run the source-contract tests and confirm all three fail for missing behavior**

Run: `node --test tests/progress-display.test.mjs`

Expected: FAIL because no progress link or publisher exists.

- [ ] **Step 3: Share the existing endpoint constant and add a fire-and-forget publisher**

Import `DEFAULT_SHEET_SYNC_URL` and `publishProgress` from `./progress-sync.mjs`, remove the duplicate page constant, and add:

```ts
const publishActiveProgress = (currentStep: number) =>
  publishProgress({
    participantId,
    planId: activePlan.id,
    currentStep,
    totalSteps: activePlan.tasks.length,
    updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
```

Inside the existing `if (shouldRecord)` block, call `void publishActiveProgress(taskNumber)` before updating `audioPlays`. Do not add calls to either preview-button handler, `markDecision`, or `handleSessionAction`.

- [ ] **Step 4: Publish zero for initial/changed plans and reset**

Add an effect keyed only by `hydrated`, `activePlanIndex`, and `participantId` that constructs the selected participant-specific plan inside the effect and publishes step 0. This avoids depending on the recreated `activePlan` object and prevents AI-audio state updates from resetting the display:

```ts
useEffect(() => {
  if (!hydrated) return;
  const selected = plans[activePlanIndex];
  const plan = selected.id === "shelf" || selected.id === "boba"
    ? { ...selected, tasks: randomizedStudyTasks(selected.id, participantId) }
    : selected;
  void publishProgress({
    participantId,
    planId: plan.id,
    currentStep: 0,
    totalSteps: plan.tasks.length,
    updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
}, [activePlanIndex, hydrated, participantId]);
```

Call `void publishActiveProgress(0)` in `resetSession` after confirmation. The effect covers plan navigation and participant changes.

- [ ] **Step 5: Add and style the same-tab display link**

Render this immediately after the participant picker:

```tsx
<a
  className="participant-display-link"
  href={`${PUBLIC_BASE_PATH}/progress?participant=${participantId}`}
>
  Participant display
</a>
```

Add these rules near the existing top-bar buttons; do not add `target`, `rel`, or click interception:

```css
.participant-display-link {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  padding: 0 16px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  border-radius: 999px;
  background: var(--paper);
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.participant-display-link:hover {
  border-color: var(--blue);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.14);
}

.participant-display-link:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.4);
  outline-offset: 3px;
}
```

- [ ] **Step 6: Run the focused tests and build**

Run: `node --test tests/progress-sync.test.mjs tests/progress-display.test.mjs`

Expected: PASS with 9 tests and 0 failures.

Run: `npm run build`

Expected: exit 0 with `/` compiling successfully and no type errors.

- [ ] **Step 7: Commit the main-console integration**

```bash
git add app/page.tsx app/globals.css tests/progress-display.test.mjs
git commit -m "feat: publish ai audio progress from console"
```

---

### Task 4: Minimal Participant Progress Page

**Files:**
- Create: `app/progress/page.tsx`
- Create: `app/progress/progress.module.css`
- Modify: `tests/progress-display.test.mjs`

**Interfaces:**
- Consumes: `fetchProgress`, `normalizeParticipantId`, and `progressPercentage` from Task 1.
- Produces: `/progress?participant=<ID>` with immediate fetch and a 1000 ms polling interval.
- Produces: one progressbar element plus one visible `output` value.

- [ ] **Step 1: Add failing minimal-markup and polling tests**

Append to `tests/progress-display.test.mjs`:

```js
test("renders only the large progress bar and current over total value", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  assert.match(progressPage, /role="progressbar"/);
  assert.match(progressPage, /aria-valuemin=\{0\}/);
  assert.match(progressPage, /aria-valuemax=\{progress\.totalSteps\}/);
  assert.match(progressPage, /\{progress\.currentStep\}\/\{progress\.totalSteps\}/);
  assert.doesNotMatch(progressPage, /<button|<a\b|<select|Participant|plan title|connection|reconnecting/i);
});

test("polls the requested participant once per second and retains state on failure", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  assert.match(progressPage, /URLSearchParams\(window\.location\.search\)/);
  assert.match(progressPage, /normalizeParticipantId/);
  assert.match(progressPage, /fetchProgress\(participantId\)/);
  assert.match(progressPage, /window\.setInterval\([^,]+,\s*1000\)/s);
  assert.match(progressPage, /catch\s*\{[\s\S]*retain the last valid value/);
  assert.match(progressPage, /window\.clearInterval/);
});
```

- [ ] **Step 2: Run the focused display test and confirm the missing-route failure**

Run: `node --test tests/progress-display.test.mjs`

Expected: FAIL with `ENOENT` for `app/progress/page.tsx`.

- [ ] **Step 3: Implement the polling lifecycle and two visible elements**

Create `app/progress/page.tsx` as a client component. Use an `EMPTY_PROGRESS` state with `participantId: 1`, `planId: "sandwich"`, `currentStep: 0`, `totalSteps: 0`, and an empty `updatedAt`. Parse the participant query on mount, reset to `EMPTY_PROGRESS` when it changes, fetch immediately, then poll every second:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  fetchProgress,
  normalizeParticipantId,
  progressPercentage,
} from "../progress-sync.mjs";
import styles from "./progress.module.css";

const EMPTY_PROGRESS = {
  participantId: 1,
  planId: "sandwich",
  currentStep: 0,
  totalSteps: 0,
  updatedAt: "",
};

export default function ProgressPage() {
  const [participantId, setParticipantId] = useState(1);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setParticipantId(normalizeParticipantId(query.get("participant")));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProgress({ ...EMPTY_PROGRESS, participantId });
    const refresh = async () => {
      try {
        const next = await fetchProgress(participantId);
        if (!cancelled) setProgress(next ?? { ...EMPTY_PROGRESS, participantId });
      } catch {
        // Intentionally retain the last valid value without adding visible UI.
      }
    };
    void refresh();
    const poller = window.setInterval(() => void refresh(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [participantId]);

  const percentage = progressPercentage(progress);
  return (
    <main className={styles.display}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={`${progress.currentStep}/${progress.totalSteps}`}
        aria-valuemin={0}
        aria-valuemax={progress.totalSteps}
        aria-valuenow={progress.currentStep}
      >
        <span className={styles.fill} style={{ width: `${percentage}%` }} />
      </div>
      <output className={styles.value} aria-live="polite">
        {progress.currentStep}/{progress.totalSteps}
      </output>
    </main>
  );
}
```

- [ ] **Step 4: Add viewport-scale styling**

Create `app/progress/progress.module.css` with:

```css
.display {
  display: grid;
  width: 100%;
  min-height: 100vh;
  align-content: center;
  gap: clamp(40px, 8vh, 96px);
  padding: clamp(32px, 8vw, 128px);
  background: #f7f2ea;
}

.track {
  width: 100%;
  height: clamp(72px, 12vw, 180px);
  overflow: hidden;
  border: clamp(4px, 0.65vw, 10px) solid #18324d;
  border-radius: 999px;
  background: #fffdf9;
  box-shadow: 0 24px 60px rgba(24, 50, 77, 0.16);
}

.fill {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: #3b82f6;
  transition: width 240ms ease;
}

.value {
  color: #172638;
  font-family: Arial, Helvetica, sans-serif;
  font-size: clamp(64px, 15vw, 180px);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 0.9;
  text-align: center;
}

@media (max-width: 640px) {
  .display {
    gap: 36px;
    padding: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
```

Do not use generated text, pseudo-element labels, or visually hidden status copy.

- [ ] **Step 5: Run route tests, full test suite, lint, and production build**

Run: `node --test tests/progress-display.test.mjs`

Expected: PASS with 5 tests and 0 failures.

Run: `npm test`

Expected: exit 0 and all repository tests pass after the production build.

Run: `npm run lint`

Expected: exit 0 with no ESLint errors or warnings.

Run: `npm run build`

Expected: exit 0 with both `/` and `/progress` compiled.

- [ ] **Step 6: Inspect the rendered route at desktop and tablet widths**

Start the approved local development command, open `/progress?participant=1`, and confirm the viewport visibly contains only the large empty bar and `0/0`. Resize once below 768 px and confirm neither element clips. Inspect accessibility properties to confirm the progressbar uses step values rather than percentage values.

- [ ] **Step 7: Commit the participant display**

```bash
git add app/progress/page.tsx app/progress/progress.module.css tests/progress-display.test.mjs
git commit -m "feat: add participant progress display"
```

---

### Task 5: Cross-Device Verification and Deployment Handoff

**Files:**
- Modify only if verification exposes a defect in a file already listed above.

**Interfaces:**
- Verifies the complete operator POST → Apps Script property → participant GET flow.
- Produces deployment instructions for updating the Apps Script web-app version.

- [ ] **Step 1: Run fresh repository verification**

Run: `npm test`

Expected: exit 0 with 0 failing tests.

Run: `npm run lint`

Expected: exit 0 with no errors or warnings.

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 2: Verify requirements against the approved spec**

Check each visible and behavioral constraint directly: same-tab link, correct participant query, AI-audio-only publisher, totals 6/20/20/12, zero reset, one-second polling, last-value retention, exactly two visible display elements, base-path-safe URL, and unchanged event-row layout.

- [ ] **Step 3: Test with the deployed Apps Script version on two browser contexts**

Update the Apps Script project with `scripts/google-sheets-sync.gs`, create a new web-app deployment version that both study computers can access, and then:

1. Open the main console as participant 1 on the operator computer.
2. Open `/progress?participant=1` on the participant computer.
3. Select Shelf and confirm `0/20` appears within one polling interval.
4. Click Shelf row 5 in the AI-audio column and confirm `5/20`.
5. Click an instruction-preview audio under the step name and confirm the display remains `5/20`.
6. Click AI-audio row 2 and confirm the display moves backward to `2/20`.
7. Reset the session and confirm `0/20`.

- [ ] **Step 4: Record final status without committing deployment credentials or generated artifacts**

Report the exact test counts, lint/build exit status, branch name, Apps Script redeployment requirement, and any remaining manual deployment action. Do not commit `.env` files, credentials, local logs, build output, or browser artifacts.

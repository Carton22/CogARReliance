# Progress Boundary Audio Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep participant progress aligned with numbered task rows while allowing `Task begin` and `Task complete` audio to play and log without changing the progress display.

**Architecture:** Add two pure task-to-progress mapping helpers to the existing progress synchronization module, with direct unit tests for numbered and boundary rows. Wire the operator console to derive totals through those helpers and publish only when the clicked recorded AI-audio row maps to a numbered step; keep playback, play-count updates, event logging, transport, polling, and the participant display unchanged.

**Tech Stack:** TypeScript/React 19, Next.js 16 with vinext, JavaScript ES modules, Node.js built-in test runner, ESLint

## Global Constraints

- Continue all implementation on the existing `progress-bar` branch.
- Only rows with a defined `sequenceNumber` count toward participant progress.
- `Task begin` and `Task complete` must remain playable and logged but must never publish progress, including when replayed after an intermediate step.
- Instruction-preview audio must remain progress-neutral.
- Plan entry, participant change, and reset must publish `0/<countable total>`.
- Derive totals from task data; do not hardcode Training's six steps or the study plans' ten steps.
- Preserve the existing `ProgressState` payload, Google Apps Script relay, participant selector, URL behavior, polling interval, and timestamp conflict handling.
- Progress publishing remains non-blocking and must not prevent playback, play-count updates, or event logging when a request fails.
- No Google Apps Script redeployment is required because its request and response schema do not change.

---

## File Structure

- `app/progress-sync.mjs`: own the pure mapping from task rows to progress totals/current steps alongside the existing progress transport helpers.
- `tests/progress-sync.test.mjs`: behaviorally test the mapping helpers with boundary and numbered rows.
- `app/page.tsx`: consume the mapping helpers when initializing, resetting, and publishing progress from recorded main AI audio.
- `tests/progress-display.test.mjs`: enforce the console wiring and verify progress filtering does not bypass play-count or event-log updates.

### Task 1: Add pure task-to-progress mapping helpers

**Files:**
- Modify: `app/progress-sync.mjs`
- Test: `tests/progress-sync.test.mjs`

**Interfaces:**
- Consumes: task-like objects with optional `sequenceNumber: number`.
- Produces: `countProgressSteps(tasks): number` and `progressStepForTask(task): number | null`.

- [ ] **Step 1: Add imports and failing behavioral tests for countable and boundary rows**

Extend the import list in `tests/progress-sync.test.mjs` with `countProgressSteps` and `progressStepForTask`, then add:

```js
test("maps only numbered task rows into progress", () => {
  const tasks = [
    { name: "Task begin" },
    { name: "Step one", sequenceNumber: 1 },
    { name: "Step two", sequenceNumber: 2 },
    { name: "Task complete" },
  ];

  assert.equal(countProgressSteps(tasks), 2);
  assert.equal(progressStepForTask(tasks[0]), null);
  assert.equal(progressStepForTask(tasks[1]), 1);
  assert.equal(progressStepForTask(tasks[2]), 2);
  assert.equal(progressStepForTask(tasks[3]), null);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/progress-sync.test.mjs
```

Expected: FAIL while loading the test because `app/progress-sync.mjs` does not yet export `countProgressSteps` or `progressStepForTask`.

- [ ] **Step 3: Implement the minimal mapping helpers**

Add these exports in `app/progress-sync.mjs` before the network transport functions:

```js
export function countProgressSteps(tasks) {
  return tasks.filter((task) => task.sequenceNumber !== undefined).length;
}

export function progressStepForTask(task) {
  return task?.sequenceNumber ?? null;
}
```

This deliberately uses the model's existing distinction: numbered real/distractor rows have a `sequenceNumber`, while both boundary rows do not.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/progress-sync.test.mjs
```

Expected: PASS, including `maps only numbered task rows into progress`.

- [ ] **Step 5: Commit the mapping helpers**

```bash
git add app/progress-sync.mjs tests/progress-sync.test.mjs
git commit -m "test: define numbered task progress mapping"
```

### Task 2: Wire countable totals and boundary-neutral playback into the console

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/progress-display.test.mjs`

**Interfaces:**
- Consumes: `countProgressSteps(tasks): number` and `progressStepForTask(task): number | null` from Task 1.
- Produces: recorded numbered AI-audio clicks publish their `sequenceNumber`; recorded boundary clicks still play, increment their audio-play count, and log, but do not call `publishActiveProgress`.

- [ ] **Step 1: Replace the recorded-playback source contract with a failing boundary-aware contract**

In `tests/progress-display.test.mjs`, replace `publishes progress only from recorded AI audio playback` with:

```js
test("publishes progress only for numbered recorded AI audio", async () => {
  const page = await readFile(pageUrl, "utf8");
  const playStart = page.indexOf("const playInstruction");
  const playEnd = page.indexOf("const markDecision", playStart);
  const playInstruction = page.slice(playStart, playEnd);
  const recordStart = playInstruction.indexOf("if (shouldRecord)");
  const recordedPlayback = playInstruction.slice(recordStart);

  assert.ok(recordStart > 0);
  assert.match(
    recordedPlayback,
    /const progressStep = progressStepForTask\(activePlan\.tasks\[taskNumber - 1\]\)/,
  );
  assert.match(recordedPlayback, /if \(progressStep !== null\)/);
  assert.match(recordedPlayback, /publishActiveProgress\(progressStep\)/);
  assert.doesNotMatch(recordedPlayback, /publishActiveProgress\(taskNumber\)/);
  assert.doesNotMatch(playInstruction.slice(0, recordStart), /publishActiveProgress/);
  assert.match(recordedPlayback, /updateTask\(planId, taskNumber/);
  assert.match(recordedPlayback, /addLog\(/);
  assert.ok(
    recordedPlayback.indexOf("publishActiveProgress(progressStep)") <
      recordedPlayback.indexOf("updateTask(planId, taskNumber"),
  );
  assert.match(page, /optionIndex,\s*false,/);
});
```

The `updateTask` and `addLog` assertions guard against accidentally returning early for boundaries or moving logging inside the numbered-step condition.

- [ ] **Step 2: Strengthen the initialization/reset contract for countable totals**

Replace `initializes and resets the active plan at step zero` with:

```js
test("initializes and resets the active plan at step zero with a countable total", async () => {
  const page = await readFile(pageUrl, "utf8");
  const publisherStart = page.indexOf("const publishActiveProgress");
  const publisherEnd = page.indexOf("useEffect", publisherStart);
  const publisher = page.slice(publisherStart, publisherEnd);
  assert.match(publisher, /totalSteps:\s*countProgressSteps\(activePlan\.tasks\)/);
  assert.doesNotMatch(publisher, /totalSteps:\s*activePlan\.tasks\.length/);

  const hydrationStart = page.indexOf("if (!hydrated) return;", page.indexOf("const activeState"));
  const hydrationEnd = page.indexOf("}, [activePlanIndex, hydrated, participantId]);", hydrationStart);
  const initialization = page.slice(hydrationStart, hydrationEnd);
  assert.ok(hydrationStart > 0 && hydrationEnd > hydrationStart);
  assert.match(initialization, /currentStep:\s*0/);
  assert.match(initialization, /totalSteps:\s*countProgressSteps\(plan\.tasks\)/);
  assert.doesNotMatch(initialization, /totalSteps:\s*plan\.tasks\.length/);

  const resetStart = page.indexOf("const resetSession");
  const resetEnd = page.indexOf("const handleParticipantIdChange", resetStart);
  assert.match(page.slice(resetStart, resetEnd), /publishActiveProgress\(0\)/);
});
```

- [ ] **Step 3: Run the focused display test and verify RED**

Run:

```bash
node --test tests/progress-display.test.mjs
```

Expected: FAIL because `app/page.tsx` still uses rendered array length and `taskNumber`.

- [ ] **Step 4: Import the mapping helpers and derive countable totals**

Change the import in `app/page.tsx` to:

```ts
import {
  countProgressSteps,
  DEFAULT_SHEET_SYNC_URL,
  progressStepForTask,
  publishProgress,
} from "./progress-sync.mjs";
```

Then update both progress payload builders:

```ts
const publishActiveProgress = (currentStep: number) =>
  publishProgress({
    participantId,
    planId: activePlan.id,
    currentStep,
    totalSteps: countProgressSteps(activePlan.tasks),
    updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
```

```ts
void publishProgress({
  participantId,
  planId: plan.id,
  currentStep: 0,
  totalSteps: countProgressSteps(plan.tasks),
  updatedAt: new Date().toISOString(),
}).catch(() => undefined);
```

- [ ] **Step 5: Publish recorded progress only for a numbered row**

Replace the beginning of the `shouldRecord` block in `playInstruction` with:

```ts
if (shouldRecord) {
  const progressStep = progressStepForTask(activePlan.tasks[taskNumber - 1]);
  if (progressStep !== null) {
    void publishActiveProgress(progressStep);
  }
  updateTask(planId, taskNumber, (current) => ({
    ...current,
    audioPlays: current.audioPlays + 1,
  }));
```

Leave the existing `addLog(...)` call after `updateTask(...)` and inside `if (shouldRecord)`. Do not add an early return: boundary rows must still reach both operations.

- [ ] **Step 6: Run focused progress tests and verify GREEN**

Run:

```bash
node --test tests/progress-sync.test.mjs tests/progress-display.test.mjs
```

Expected: PASS. The mapping tests prove boundaries return `null`; the display contract proves only non-null steps publish while playback bookkeeping and logging stay on the recorded path.

- [ ] **Step 7: Run full automated verification**

Run each command separately:

```bash
npm test
npm run lint
git diff --check
```

Expected: `npm test` completes the production build and all Node tests with exit 0; ESLint exits 0; `git diff --check` prints no whitespace errors.

- [ ] **Step 8: Commit the console compatibility change**

```bash
git add app/page.tsx tests/progress-display.test.mjs
git commit -m "fix: exclude boundary audio from progress"
```

## Final Verification

- [ ] Confirm `git status --short --branch` is clean and reports `progress-bar`.
- [ ] Confirm `git diff origin/main...HEAD -- app/progress-sync.mjs app/page.tsx tests/progress-sync.test.mjs tests/progress-display.test.mjs` contains no Apps Script, progress-page layout, participant selector, or URL changes.
- [ ] On an operator page and participant display using the same participant, verify `Task begin` leaves the display at `0/total`, the first numbered AI audio shows `1/total`, an intermediate numbered audio shows its printed sequence number, replaying either boundary preserves that value, and the last numbered AI audio shows `total/total`.
- [ ] Confirm boundary clicks still increment their local play count and add `start`/`complete` event-log entries with an empty spreadsheet task number.
- [ ] Report the exact focused/full test results, lint status, branch name, commit hashes, and that Google Apps Script redeployment is not required.

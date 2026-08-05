# Progress Participant Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmed participant dropdown to the progress display that switches polling targets and updates the shareable URL without reloading.

**Architecture:** Extend the existing shared progress module with pure participant-label and URL-building helpers, then consume them from the client progress page. The page keeps `participantId` as the single source of truth: a confirmed selection replaces the current URL and changes state, which reuses the existing participant-dependent effect to reset progress, cancel the old poller, fetch immediately, and poll the new participant every second.

**Tech Stack:** Next.js 16 App Router, React 19 client components, JavaScript ES modules, TypeScript/TSX, CSS Modules, Node.js built-in test runner

## Global Constraints

- Work only on the existing `progress-bar` branch.
- Keep the large progress bar and `current/total` value as the page's primary content.
- Render a native participant `<select>` near the viewport's top-right corner.
- Support participant IDs 1 through 36 and display them as `Participant 01` through `Participant 36`.
- Ask for confirmation only when the selected participant differs from the active participant.
- Confirmation copy is `Switch progress display from Participant 01 to Participant 02?`, substituting the active and proposed two-digit IDs.
- Cancelling changes no participant, URL, displayed progress, or polling target.
- Confirming updates the `participant` query parameter with `history.replaceState`; do not reload and do not add a Back-button history entry.
- Preserve the current pathname, unrelated query parameters, and URL hash.
- A confirmed participant change clears the old participant's visible progress before fetching the new participant.
- Continue polling immediately and once per second through the existing effect.
- Do not publish progress merely because the participant display switches its polling target.
- Do not add dependencies.

---

## File Map

- Modify `app/progress-sync.mjs`: add pure helpers for zero-padded participant labels and participant-specific display URLs.
- Modify `tests/progress-sync.test.mjs`: directly test label formatting, ID normalization in URLs, and preservation of pathname, unrelated query parameters, and hash.
- Modify `app/progress/page.tsx`: render the controlled selector and implement same-ID, cancel, and confirmed-selection behavior.
- Modify `app/progress/progress.module.css`: anchor the selector near the top-right and keep it usable on narrow screens.
- Modify `tests/progress-display.test.mjs`: replace the obsolete no-selector assertion and verify the selector, confirmation guard, URL replacement order, and top-right style contract.

---

### Task 1: Participant Label and URL Helpers

**Files:**
- Modify: `tests/progress-sync.test.mjs`
- Modify: `app/progress-sync.mjs`

**Interfaces:**
- Consumes: `normalizeParticipantId(value: unknown): number` from `app/progress-sync.mjs`.
- Produces: `formatParticipantLabel(value: unknown): string`, returning a normalized label such as `Participant 07`.
- Produces: `participantProgressUrl(currentUrl: string | URL, participantId: unknown): string`, returning `pathname + search + hash` with a normalized `participant` query value.

- [ ] **Step 1: Write failing behavioral tests for labels and URL construction**

Add both exports to the import list in `tests/progress-sync.test.mjs`:

```js
import {
  fetchProgress,
  formatParticipantLabel,
  normalizeParticipantId,
  normalizeProgress,
  participantProgressUrl,
  progressPercentage,
  publishProgress,
  selectNewerProgress,
} from "../app/progress-sync.mjs";
```

Append these tests after the participant-normalization test:

```js
test("formats normalized participant IDs as two-digit labels", () => {
  assert.equal(formatParticipantLabel(1), "Participant 01");
  assert.equal(formatParticipantLabel("7"), "Participant 07");
  assert.equal(formatParticipantLabel(36), "Participant 36");
  assert.equal(formatParticipantLabel("invalid"), "Participant 01");
});

test("replaces only the participant query value in a progress URL", () => {
  assert.equal(
    participantProgressUrl(
      "https://carton22.github.io/CogARReliance/progress?participant=1&display=large#bar",
      12,
    ),
    "/CogARReliance/progress?participant=12&display=large#bar",
  );
  assert.equal(
    participantProgressUrl("https://example.test/progress?display=large", 37),
    "/progress?display=large&participant=1",
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/progress-sync.test.mjs
```

Expected: FAIL because `formatParticipantLabel` and `participantProgressUrl` are not exported by `app/progress-sync.mjs`.

- [ ] **Step 3: Implement the minimal pure helpers**

Add these functions immediately after `normalizeParticipantId` in `app/progress-sync.mjs`:

```js
export function formatParticipantLabel(value) {
  return `Participant ${String(normalizeParticipantId(value)).padStart(2, "0")}`;
}

export function participantProgressUrl(currentUrl, participantId) {
  const url = new URL(currentUrl);
  url.searchParams.set("participant", String(normalizeParticipantId(participantId)));
  return `${url.pathname}${url.search}${url.hash}`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/progress-sync.test.mjs
```

Expected: all tests in `tests/progress-sync.test.mjs` PASS with no warnings or errors.

- [ ] **Step 5: Commit the helper contract**

```bash
git add app/progress-sync.mjs tests/progress-sync.test.mjs
git commit -m "feat: add participant progress URL helpers"
```

---

### Task 2: Confirmed Participant Selector

**Files:**
- Modify: `tests/progress-display.test.mjs`
- Modify: `app/progress/page.tsx`
- Modify: `app/progress/progress.module.css`

**Interfaces:**
- Consumes: `formatParticipantLabel(value: unknown): string` from Task 1.
- Consumes: `participantProgressUrl(currentUrl: string | URL, participantId: unknown): string` from Task 1.
- Consumes: existing `participantId: number` state and its participant-dependent polling effect in `app/progress/page.tsx`.
- Produces: `handleParticipantChange(value: string): void`, which does nothing for the active ID or cancelled confirmation and commits an approved ID through `replaceState` followed by `setParticipantId`.

- [ ] **Step 1: Replace the obsolete minimal-page test with a failing selector-rendering contract**

In `tests/progress-display.test.mjs`, replace `renders only the large progress bar and current over total value` with:

```js
test("renders a participant selector with the large progress display", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  const renderedMarkup = progressPage.slice(progressPage.indexOf("<main"), progressPage.lastIndexOf("</main>") + 7);
  assert.match(progressPage, /role="progressbar"/);
  assert.match(progressPage, /aria-valuemin=\{0\}/);
  assert.match(progressPage, /aria-valuemax=\{progress\.totalSteps\}/);
  assert.match(progressPage, /\{progress\.currentStep\}\/\{progress\.totalSteps\}/);
  assert.match(renderedMarkup, /<select/);
  assert.match(renderedMarkup, /value=\{participantId\}/);
  assert.match(renderedMarkup, /Array\.from\(\{ length: 36 \}/);
  assert.match(renderedMarkup, /formatParticipantLabel\(id\)/);
  assert.doesNotMatch(renderedMarkup, /<button|<a\b|plan title|connection|reconnecting/i);
});
```

Append a source-contract test for the interaction ordering:

```js
test("confirms a different participant before replacing the URL and polling target", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  const handlerStart = progressPage.indexOf("const handleParticipantChange");
  const handlerEnd = progressPage.indexOf("const percentage", handlerStart);
  const handler = progressPage.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart > 0 && handlerEnd > handlerStart);
  assert.match(handler, /if \(nextParticipantId === participantId\) return/);
  assert.match(handler, /window\.confirm/);
  assert.match(handler, /Switch progress display from \$\{formatParticipantLabel\(participantId\)\} to \$\{formatParticipantLabel\(nextParticipantId\)\}\?/);
  assert.match(handler, /if \(!confirmed\) return/);
  assert.match(handler, /window\.history\.replaceState/);
  assert.match(handler, /participantProgressUrl\(window\.location\.href, nextParticipantId\)/);
  assert.match(handler, /setParticipantId\(nextParticipantId\)/);
  assert.ok(handler.indexOf("window.confirm") < handler.indexOf("window.history.replaceState"));
  assert.ok(handler.indexOf("window.history.replaceState") < handler.indexOf("setParticipantId"));
});
```

Append a CSS contract test:

```js
test("positions the participant selector near the top-right corner", async () => {
  const css = await readFile(new URL("../app/progress/progress.module.css", import.meta.url), "utf8");
  const selectorStart = css.indexOf(".participantPicker");
  const selectorEnd = css.indexOf("}", selectorStart);
  const selectorRule = css.slice(selectorStart, selectorEnd);

  assert.ok(selectorStart >= 0);
  assert.match(selectorRule, /position:\s*fixed/);
  assert.match(selectorRule, /top:/);
  assert.match(selectorRule, /right:/);
});
```

- [ ] **Step 2: Run the focused display test and verify RED**

Run:

```bash
node --test tests/progress-display.test.mjs
```

Expected: FAIL because the page does not yet render a `<select>`, define `handleParticipantChange`, or style `.participantPicker`.

- [ ] **Step 3: Add the confirmed participant-change handler**

Extend the import from `../progress-sync.mjs` in `app/progress/page.tsx`:

```tsx
import {
  fetchProgress,
  formatParticipantLabel,
  normalizeParticipantId,
  participantProgressUrl,
  progressPercentage,
  selectNewerProgress,
} from "../progress-sync.mjs";
```

Add this handler after the two effects and before `const percentage`:

```tsx
  const handleParticipantChange = (value: string) => {
    const nextParticipantId = normalizeParticipantId(value);
    if (nextParticipantId === participantId) return;

    const confirmed = window.confirm(
      `Switch progress display from ${formatParticipantLabel(participantId)} to ${formatParticipantLabel(nextParticipantId)}?`,
    );
    if (!confirmed) return;

    window.history.replaceState(
      window.history.state,
      "",
      participantProgressUrl(window.location.href, nextParticipantId),
    );
    setParticipantId(nextParticipantId);
  };
```

Do not add a direct fetch to the handler. `setParticipantId` must remain the only operation that changes the polling target, allowing the existing effect cleanup and synchronous `0/0` reset to run in one place.

- [ ] **Step 4: Render the controlled native selector**

Place this label as the first child of `<main className={styles.display}>` in `app/progress/page.tsx`:

```tsx
      <label className={styles.participantPicker}>
        <span>Participant</span>
        <select
          value={participantId}
          onChange={(event) => handleParticipantChange(event.target.value)}
          aria-label="Progress participant"
        >
          {Array.from({ length: 36 }, (_, index) => index + 1).map((id) => (
            <option key={id} value={id}>
              {formatParticipantLabel(id)}
            </option>
          ))}
        </select>
      </label>
```

Because `value` remains bound to `participantId`, cancelling confirmation leaves React state unchanged and the browser restores the active option on the next controlled render.

- [ ] **Step 5: Add compact top-right styling**

Add these rules after `.display` in `app/progress/progress.module.css`:

```css
.participantPicker {
  position: fixed;
  top: clamp(20px, 3vw, 40px);
  right: clamp(20px, 3vw, 40px);
  z-index: 1;
  display: grid;
  gap: 6px;
  color: #172638;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.participantPicker select {
  min-width: 164px;
  min-height: 44px;
  padding: 0 38px 0 14px;
  border: 2px solid #18324d;
  border-radius: 12px;
  background: #fffdf9;
  color: #172638;
  font: inherit;
  letter-spacing: normal;
  cursor: pointer;
}

.participantPicker select:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 3px;
}
```

Extend the existing `@media (max-width: 640px)` block with:

```css
  .participantPicker {
    top: 16px;
    right: 16px;
  }

  .participantPicker span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .participantPicker select {
    min-width: 148px;
  }
```

- [ ] **Step 6: Run the focused display test and verify GREEN**

Run:

```bash
node --test tests/progress-display.test.mjs
```

Expected: all tests in `tests/progress-display.test.mjs` PASS with no warnings or errors.

- [ ] **Step 7: Run the complete automated verification**

Run each command separately:

```bash
npm test
npm run lint
```

Expected: the production build and full Node test suite PASS; ESLint exits 0 with no errors.

- [ ] **Step 8: Manually verify the browser interaction**

Run:

```bash
npm run dev
```

Open `/progress?participant=1`, then verify:

1. The top-right dropdown displays `Participant 01` and contains IDs 01 through 36.
2. Re-selecting Participant 01 opens no confirmation.
3. Select Participant 02 and cancel; the dropdown, URL, and progress remain on Participant 01.
4. Select Participant 02 and confirm; the URL becomes `?participant=2` without a page reload, the old progress disappears, and Participant 02's progress appears after a successful poll.
5. Refreshing retains Participant 02 because the URL contains `participant=2`.
6. Narrow the viewport below 640px and confirm the selector does not overlap or clip the progress bar or numeric value.

- [ ] **Step 9: Commit the selector UI**

```bash
git add app/progress/page.tsx app/progress/progress.module.css tests/progress-display.test.mjs
git commit -m "feat: add confirmed progress participant selector"
```

---

## Final Branch Verification

- [ ] Confirm `git branch --show-current` prints `progress-bar`.
- [ ] Confirm `git status --short` is clean.
- [ ] Confirm `git log -2 --oneline` contains both implementation commits from this plan.
- [ ] Push `progress-bar` and update the existing pull request only after the user authorizes or requests publication.

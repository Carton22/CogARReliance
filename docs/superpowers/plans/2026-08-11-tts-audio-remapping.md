# OpenAI TTS Audio Remapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate nine OpenAI TTS WAV clips and map every affected training, shelf, and boba instruction to audio that speaks its exact displayed text.

**Architecture:** Keep audio files grouped under the existing task-family directories and use descriptive WAV filenames. Extend the existing task configuration with index-keyed distractor and recovery overrides, allowing only the requested cues to depart from the legacy filename convention while preserving randomization and all unaffected mappings.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node.js test runner, OpenAI Text-to-Speech web UI in Chrome, WAV audio assets.

---

## File Structure

- Modify `tests/rendered-html.test.mjs`: assert every requested text-to-audio mapping and every new WAV asset.
- Modify `app/page.tsx`: add training overrides, update the shelf recovery text, and add explicit distractor/recovery audio overrides.
- Create three WAV files in `public/audio/training/`: the new training cues.
- Create three WAV files in `public/audio/shelf-assembly-distractors/`: the requested shelf recovery cues.
- Create three WAV files in `public/audio/boba-distractors/`: the requested boba distractor/recovery cues.

### Task 1: Add Failing Mapping and Asset Tests

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Test: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Replace the training mapping assertions with exact requested sources**

In `test("inserts the misleading training top-piece step between steps 3 and 4", ...)`, add these assertions after reading `page`:

```js
assert.match(
  page,
  /text: "Put a long piece on the top",\s+audioSrc: "\/audio\/training\/training_put_long_piece_top\.wav"/,
);
assert.match(
  page,
  /0: "\/audio\/training\/training_put_square_slot3\.wav"/,
);
assert.match(
  page,
  /1: "\/audio\/training\/training_put_square_slot4\.wav"/,
);
assert.match(
  page,
  /2: "\/audio\/training\/training_put_long_piece_top\.wav"/,
);
```

- [ ] **Step 2: Add a focused distractor mapping test**

In the existing participant-stable distractor test, replace:

```js
assert.match(page, /"Remove the purple"/);
```

with:

```js
assert.match(page, /"remove the purple at slot3"/);
```

Add this test after the participant-stable distractor test:

```js
test("maps requested shelf and boba cues to matching TTS audio", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /"remove the purple at slot3"/);
  assert.doesNotMatch(page, /"Remove the purple"/);
  assert.match(
    page,
    /0: "\/audio\/shelf-assembly-distractors\/shelf_remove_purple_slot3\.wav"/,
  );
  assert.match(
    page,
    /1: "\/audio\/shelf-assembly-distractors\/shelf_remove_pink_slot5\.wav"/,
  );
  assert.match(
    page,
    /2: "\/audio\/shelf-assembly-distractors\/shelf_return_black\.wav"/,
  );
  assert.match(
    page,
    /1: "\/audio\/boba-distractors\/boba_grab_fork\.wav"/,
  );
  assert.match(
    page,
    /1: "\/audio\/boba-distractors\/boba_put_fork_down\.wav"/,
  );
  assert.match(
    page,
    /2: "\/audio\/boba-distractors\/boba_remove_lemon\.wav"/,
  );
});
```

- [ ] **Step 3: Replace the affected legacy asset entries with the nine WAV paths**

In `test("has audio assets for training and configured wrong suggestions", ...)`, preserve all unaffected paths and add:

```js
"../public/audio/training/training_put_long_piece_top.wav",
"../public/audio/training/training_put_square_slot3.wav",
"../public/audio/training/training_put_square_slot4.wav",
"../public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.wav",
"../public/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.wav",
"../public/audio/shelf-assembly-distractors/shelf_return_black.wav",
"../public/audio/boba-distractors/boba_grab_fork.wav",
"../public/audio/boba-distractors/boba_put_fork_down.wav",
"../public/audio/boba-distractors/boba_remove_lemon.wav",
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern="training top-piece|requested shelf and boba|audio assets" tests/rendered-html.test.mjs
```

Expected: FAIL because the new source mappings and WAV files do not exist yet. Confirm the failure names the new mapping or asset rather than a syntax error.

- [ ] **Step 5: Commit the failing tests**

```bash
git add tests/rendered-html.test.mjs
git commit -m "test: require matching TTS cue audio"
```

### Task 2: Generate and Place the OpenAI TTS WAV Files

**Files:**
- Create: `public/audio/training/training_put_long_piece_top.wav`
- Create: `public/audio/training/training_put_square_slot3.wav`
- Create: `public/audio/training/training_put_square_slot4.wav`
- Create: `public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.wav`
- Create: `public/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.wav`
- Create: `public/audio/shelf-assembly-distractors/shelf_return_black.wav`
- Create: `public/audio/boba-distractors/boba_grab_fork.wav`
- Create: `public/audio/boba-distractors/boba_put_fork_down.wav`
- Create: `public/audio/boba-distractors/boba_remove_lemon.wav`

- [ ] **Step 1: Confirm the OpenAI TTS controls in Chrome**

Use the already-open `https://platform.openai.com/audio/tts` Chrome tab. Confirm these visible controls remain selected:

```text
Model: gpt-4o-mini-tts
Voice: Nova
Speed: 1.00x
Response format: WAV
Instructions: Speak in professional way for a presentation in academic paper and user study
```

- [ ] **Step 2: Generate and download each unique phrase**

For each line below, replace the text input, submit it, wait for the waveform/player, and click its download control:

```text
Put a long piece on the top
Put a square piece at slot 3
Put a square piece at slot 4
remove the purple at slot3
remove the pink at slot5
Return the black
Grab a fork
Put the fork down
Remove the lemon
```

Record the downloaded filename immediately after each generation so no clip is assigned by guesswork.

- [ ] **Step 3: Move each downloaded WAV to its descriptive repository path**

Move the nine recorded Chrome download paths to the exact destinations listed in this task. Use one explicit `mv` command per source path returned by the Chrome download event; do not use a wildcard or infer ordering from filesystem timestamps. Match each destination to the phrase recorded beside that download in Step 2.

- [ ] **Step 4: Validate all WAV files**

Run:

```bash
file \
  public/audio/training/training_put_long_piece_top.wav \
  public/audio/training/training_put_square_slot3.wav \
  public/audio/training/training_put_square_slot4.wav \
  public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.wav \
  public/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.wav \
  public/audio/shelf-assembly-distractors/shelf_return_black.wav \
  public/audio/boba-distractors/boba_grab_fork.wav \
  public/audio/boba-distractors/boba_put_fork_down.wav \
  public/audio/boba-distractors/boba_remove_lemon.wav
```

Expected: every line reports RIFF/WAVE audio data.

Run:

```bash
find public/audio/training public/audio/shelf-assembly-distractors public/audio/boba-distractors \
  -type f -name '*.wav' -size 0 -print
```

Expected: no output.

- [ ] **Step 5: Commit the generated assets**

```bash
git add public/audio/training/*.wav public/audio/shelf-assembly-distractors/*.wav public/audio/boba-distractors/*.wav
git commit -m "feat: add requested OpenAI TTS cues"
```

### Task 3: Map Training Steps 4–7 to Matching Audio

**Files:**
- Modify: `app/page.tsx:74-109`
- Test: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Replace the training step 4 incorrect audio source**

Change the incorrect option to:

```ts
incorrectOptions: [
  {
    text: "Put a long piece on the top",
    audioSrc: "/audio/training/training_put_long_piece_top.wav",
  },
],
```

- [ ] **Step 2: Replace the post-distractor training overrides**

Change the final `correctTasks` override object to:

```ts
{
  0: "/audio/training/training_put_square_slot3.wav",
  1: "/audio/training/training_put_square_slot4.wav",
  2: "/audio/training/training_put_long_piece_top.wav",
}
```

- [ ] **Step 3: Run the focused training test and verify GREEN**

Run:

```bash
node --test --test-name-pattern="training top-piece" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit the training mappings**

```bash
git add app/page.tsx
git commit -m "fix: align training audio with cue text"
```

### Task 4: Map Shelf and Boba Distractor Audio

**Files:**
- Modify: `app/page.tsx:157-246`
- Test: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Add override fields to the randomized task configuration type**

Add the two optional properties to the existing configuration type:

```ts
distractorAudioOverrides?: Record<number, string>;
recoveryAudioOverrides?: Record<number, string>;
```

- [ ] **Step 2: Update shelf text and configure shelf recovery overrides**

Change the shelf recovery text array and shelf configuration to include:

```ts
const shelfDistractorRecoverySteps = [
  "remove the purple at slot3",
  "remove the pink at slot5",
  "Return the black",
];
```

```ts
recoveryAudioOverrides: {
  0: "/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.wav",
  1: "/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.wav",
  2: "/audio/shelf-assembly-distractors/shelf_return_black.wav",
},
```

- [ ] **Step 3: Configure boba distractor and recovery overrides**

Add these fields to the boba configuration:

```ts
distractorAudioOverrides: {
  1: "/audio/boba-distractors/boba_grab_fork.wav",
},
recoveryAudioOverrides: {
  1: "/audio/boba-distractors/boba_put_fork_down.wav",
  2: "/audio/boba-distractors/boba_remove_lemon.wav",
},
```

- [ ] **Step 4: Consume overrides while building randomized tasks**

Replace the two generated `audioSrc` expressions with:

```ts
audioSrc:
  config.distractorAudioOverrides?.[index] ??
  `/audio/${config.folder}/${config.prefix}_${distractor}.mp3`,
```

and:

```ts
audioSrc:
  config.recoveryAudioOverrides?.[index] ??
  `/audio/${config.folder}/${config.prefix}_${distractor}_recovery.mp3`,
```

- [ ] **Step 5: Run the focused distractor tests and verify GREEN**

Run:

```bash
node --test --test-name-pattern="participant-stable distractors|requested shelf and boba|audio assets" tests/rendered-html.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the distractor mappings**

```bash
git add app/page.tsx
git commit -m "fix: align recovery and distractor audio"
```

### Task 5: Full Verification and Browser Playback

**Files:**
- Verify: `app/page.tsx`
- Verify: `tests/rendered-html.test.mjs`
- Verify: `public/audio/training/*.wav`
- Verify: `public/audio/shelf-assembly-distractors/*.wav`
- Verify: `public/audio/boba-distractors/*.wav`

- [ ] **Step 1: Run the complete unit test suite**

```bash
npm run test:unit
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: exit code 0 and a completed production build.

- [ ] **Step 4: Verify the working tree and diff**

```bash
git status --short
git diff --check HEAD~4..HEAD
git log -5 --oneline
```

Expected: clean working tree; no whitespace errors; separate commits for the design, tests, assets, and mappings.

- [ ] **Step 5: Start the local site for playback verification**

```bash
npm run dev
```

Expected: the console starts and prints its local URL.

- [ ] **Step 6: Play and verify every affected cue in Chrome**

Open the local console in Chrome. Play training steps 4, 5, 6, and 7; the shelf purple/pink/black recovery cues; and the boba fork/lemon distractor or recovery cues. Confirm each spoken phrase matches its displayed text exactly and that all nine controls play without a browser audio error.

- [ ] **Step 7: Stop the local development server and report evidence**

Stop the server with `Ctrl-C`. Report the unit-test count, lint/build exit status, WAV validation output, and the browser playback checklist. Do not claim completion if any cue differs from its displayed text.

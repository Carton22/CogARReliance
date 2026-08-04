# Deterministic Study Randomization Design

## Scope

Apply participant-stable 20-step sequences to shelf and boba: 15 correct instructions plus five injected distractors. Replace the participant control with an iPhone-style scroll wheel and remove Recovery styling.

## Sequence generation

For each task, group correct instructions into five blocks: 1–3, 4–6, 7–9, 10–12, and 13–15. Assign each distractor A–E to a block using a seeded pseudo-random shuffle. Use the same seed to choose one of four insertion points per block: before its first correct instruction, between the first and second, between the second and third, or after its third.

The seed is derived solely from participant ID and task ID. It produces the same 20-step order for the same participant/task after refresh, reset, or rebuilding the application, without relying on local storage.

## UI

The participant selector is a vertically scrollable, scroll-snapped wheel showing the selected number in a central highlight band. It supports pointer/touch scrolling and keyboard changes, with values restricted to 1–36. Remove the Recovery legend and green recovery color from task instruction cues.

## Verification

Tests will assert that every generated shelf/boba sequence has 20 steps, each contains 15 correct and five unique distractors, and a participant/task combination is stable. Tests will also cover the four valid insertion positions and ensure Recovery UI tokens are absent. Lint and production build will run.

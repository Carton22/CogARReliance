# Progress Boundary Audio Compatibility Design

## Goal

Keep participant-facing progress aligned with real task steps after every plan gains `Task begin` and `Task complete` audio rows. Boundary audio must remain playable and logged but must not change either the current progress step or the total step count.

## Current Problem

`withBoundaryTasks` adds two rows around every plan. The progress publisher currently uses the rendered array index as `currentStep` and `activePlan.tasks.length` as `totalSteps`. This incorrectly treats `Task begin` as step 1, shifts every real task by one, treats `Task complete` as an additional step, and inflates the denominator by two.

The task model already distinguishes countable rows: real task and distractor rows receive a one-based `sequenceNumber`, while both boundary rows leave `sequenceNumber` undefined.

## Progress Semantics

Only rows with a defined `sequenceNumber` count toward participant progress.

- `totalSteps` is the number of active-plan rows whose `sequenceNumber` is defined.
- Clicking a countable row's main `AI audio` publishes that row's `sequenceNumber` as `currentStep`.
- Clicking `Task begin` publishes nothing and leaves the current display unchanged.
- Clicking `Task complete` publishes nothing and leaves the current display unchanged.
- Replaying either boundary audio after progress has advanced also leaves the display unchanged.
- Instruction-preview audio remains progress-neutral.
- Opening a plan, changing participants, or resetting the active plan publishes `0/<countable total>`.

Totals are derived rather than hardcoded. With the current plans, Training has six countable rows and each study plan has ten countable rows; adding or removing future countable rows automatically updates the denominator.

## Architecture and Data Flow

The main console derives countable progress from `activePlan.tasks` and keeps the existing `ProgressState` payload contract:

```ts
type ProgressState = {
  participantId: number;
  planId: PlanId;
  currentStep: number;
  totalSteps: number;
  updatedAt: string;
};
```

`publishActiveProgress(currentStep)` uses the countable-row total instead of the full rendered row count.

Inside recorded AI-audio playback, the console looks up the clicked row from `activePlan.tasks[taskNumber - 1]`. It publishes progress only when that row has a defined `sequenceNumber`, passing the sequence number rather than the raw rendered index. Playback, audio-play counts, and event logging continue for every recorded main audio, including boundary rows.

Plan-initialization logic applies the same countable-total derivation before publishing step zero. The progress page, Google Apps Script relay, participant selection, polling, monotonic timestamp handling, and URL behavior do not change.

## Boundary Logging

Boundary audio keeps its existing logging behavior:

- `Task begin` logs the `start` action.
- `Task complete` logs the `complete` action.
- Their spreadsheet task number remains empty because they have no `sequenceNumber`.

Progress filtering is independent of event logging. Ignoring a boundary for progress must not suppress its audio playback, play counter, or log entry.

## Error Handling

Progress publishing remains non-blocking. A failed progress request must not stop audio playback or event logging. Boundary rows do not make a progress request, so replaying them cannot overwrite or reset a participant's last valid progress.

## Testing

Automated tests will verify:

- Countable totals are derived from defined `sequenceNumber` values rather than `activePlan.tasks.length`.
- Recorded countable AI audio publishes its `sequenceNumber`.
- `Task begin` and `Task complete` audio do not publish progress.
- Boundary audio continues through the recorded playback and logging path.
- Plan initialization and reset publish step zero using the countable total.
- Preview audio remains progress-neutral.
- Existing progress polling, participant switching, Apps Script relay tests, the production build, and lint remain green.

Manual verification will use an operator page and participant display for the same participant. It will confirm that boundary clicks leave progress unchanged, the first countable AI audio displays `1/total`, the last displays `total/total`, and replaying either boundary after an intermediate step preserves that intermediate value.

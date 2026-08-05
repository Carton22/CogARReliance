# Cross-Device Progress Display Design

## Goal

Add a participant-facing progress page that mirrors the most recently clicked AI-audio step on an operator's separate computer. The page must show only a large progress bar and a `current step / total steps` value.

## Scope

- Add a `/progress` page for the participant-facing display.
- Add a `Participant display` link near the top of the main console.
- Synchronize progress between computers through the existing Google Apps Script endpoint.
- Make only AI-audio-column clicks update progress.
- Keep instruction-preview audio clicks, accept/reject decisions, and session audio from changing progress.
- Preserve the existing event log and Google Sheets row format.

The feature does not add authentication, push notifications, a new database, progress history, or extra participant-facing labels and controls.

## User Experience

The main console's `Participant display` link navigates to `/progress?participant=<current participant ID>` in the same browser tab. The route can also be opened directly on the participant's computer with the appropriate participant query value.

The progress page contains exactly:

1. One large horizontal progress bar.
2. One large text value formatted as `<current step>/<total steps>`.

It does not visibly render the participant ID, task-plan title, connection status, buttons, selectors, navigation, or instructional copy. Participant and plan identifiers remain internal synchronization data.

Before a plan has an AI-audio click, its display state is `0/<total steps>`. Clicking the AI-audio control for displayed row `N` changes it to `N/<total steps>`. Clicking an earlier row moves the value and bar backward. Replaying the same row keeps the same progress position.

The bar fill is `currentStep / totalSteps * 100`, clamped from 0% to 100%. A missing initial state renders `0/0` with an empty bar until the first valid state is retrieved.

## Step Totals

The total is derived from the number of rows currently rendered in the `Task sequence & instructions` column, not from the number of correct instructions:

- Sandwich plan: 6
- Shelf assembly plan: 20, including five participant-specific distractor rows
- Boba tea plan: 20, including five participant-specific distractor rows
- Table assembly plan: 12

This derivation ensures the displayed row number, AI-audio button, and progress denominator use the same task ordering.

## Architecture

### Main console publisher

The main page creates a progress payload with this shape:

```ts
type ProgressState = {
  participantId: number;
  planId: PlanId;
  currentStep: number;
  totalSteps: number;
  updatedAt: string;
};
```

It sends the payload to the configured Google Apps Script URL as:

```json
{
  "type": "progress",
  "progress": {
    "participantId": 1,
    "planId": "sandwich",
    "currentStep": 1,
    "totalSteps": 6,
    "updatedAt": "2026-08-04T12:00:00.000Z"
  }
}
```

Progress is published when:

- The operator changes plans: publish step 0 with the newly displayed plan's total.
- The operator clicks an AI-audio-column control: publish that displayed row number and total.
- The operator resets the session: publish step 0 for the active plan.
- The operator selects a different participant: publish step 0 for the active plan under the new participant ID.

The existing instruction-preview buttons call playback with `shouldRecord = false`. They remain preview-only and do not invoke the progress publisher. Accept/reject and session controls also do not publish progress.

Progress publishing is separate from event-log publishing. A progress synchronization failure must not prevent audio playback or existing event logging.

### Google Apps Script relay

`doPost` branches on `payload.type`:

- `type === "progress"`: validate and normalize the progress fields, then store the latest JSON value in document properties under a key scoped to the participant ID. Do not append a spreadsheet row.
- Any existing event-log payload: continue through the current participant-sheet append behavior unchanged.

`doGet(event)` accepts `participant=<ID>`. When that query is present, it returns:

```json
{
  "ok": true,
  "progress": {
    "participantId": 1,
    "planId": "sandwich",
    "currentStep": 1,
    "totalSteps": 6,
    "updatedAt": "2026-08-04T12:00:00.000Z"
  }
}
```

When no state exists for that participant, `progress` is `null`. A GET without a participant query preserves the current health-response behavior.

### Progress-page subscriber

The progress page reads and validates the `participant` query parameter, defaulting to participant 1 when it is absent or outside 1 through 36. It requests the configured Apps Script URL with that participant once on load and then once per second.

Valid responses replace the displayed state. A missing state produces `0/0`. Temporary request failures retain the last valid value silently, because the approved interface has no visible connection-status element. Polling stops when the component unmounts.

## Configuration and Deployment

Both pages use the same existing default Apps Script URL. The progress route must honor `NEXT_PUBLIC_BASE_PATH` so it works both locally and under `/CogARReliance` on GitHub Pages.

Because the Apps Script source changes, its web-app deployment must be updated after the repository change is deployed. The deployment must permit both computers to access it. The existing sheet-sync URL field remains unchanged; a custom URL configured only in the operator browser is not automatically known to a different computer, so the shared deployed default URL is the cross-device source of truth for this feature.

## Error Handling

- Invalid outgoing progress values are rejected by Apps Script without altering the latest valid state.
- A malformed or unsuccessful GET response is ignored by the progress page.
- Network failures do not clear a previously displayed value.
- An absent participant state renders `0/0`.
- Progress values are clamped before rendering so malformed remote values cannot overflow the bar.

## Accessibility and Responsive Layout

The bar uses `role="progressbar"` with step-based `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` values. The numeric value is available as visible text and as an accessible label. The page fills the viewport, keeps generous contrast, and scales the bar and value for a distant participant display across desktop and tablet-sized screens. Reduced-motion preferences disable nonessential fill transitions.

## Testing

Automated tests will verify:

- The main page publishes progress only from AI-audio-column clicks.
- Plan changes, participant changes, and reset publish step 0 with the active rendered total.
- Preview audio controls do not publish progress.
- The progress route polls by participant, renders the bar and `current/total`, and contains no prohibited labels or controls.
- Apps Script stores progress separately from event-log rows and returns it by participant.
- Existing Google Sheets logging behavior and source-format expectations remain intact.
- The full production build, Node test suite, and ESLint checks pass.

Manual verification will use two browser contexts configured with the same Apps Script deployment: one on the operator console and one on the participant progress route. It will confirm a visible update within approximately one polling interval after an AI-audio click and no change after a preview-audio click.

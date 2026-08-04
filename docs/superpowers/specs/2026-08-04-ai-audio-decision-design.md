# AI Audio Decision Columns Design

## Goal

Simplify the task control matrix so each task records whether the participant accepted or rejected the AI instruction.

## Approved layout

The right side of every matrix row will contain exactly three columns:

1. **AI audio** — keeps the existing main-instruction play control and audio-play logging.
2. **Accept** — records that the participant accepted the AI instruction for this step.
3. **Reject** — records that the participant rejected the AI instruction for this step.

The existing User act start, User act end, Appropriate reliance, Over reliance, Under reliance, and App reject columns will be removed from the matrix.

## Data and interaction behavior

Each task will store one decision, either `accept` or `reject`. Choosing a decision replaces the previous one for that task, so the two controls are mutually exclusive. A decision is timestamped in the existing local event log and consequently included in CSV export. Existing AI-audio play recording is unchanged.

## UI and accessibility

Accept and Reject use the existing circular action-control pattern, show a selected state, expose pressed state to assistive technology, and have descriptive labels. The progress summary will show recorded decisions instead of the removed act and reliance counts.

## Verification

Automated source-level tests will assert the three headers, the absence of retired headers, and the accept/reject controls. The existing build and rendered-page test suite will also run.

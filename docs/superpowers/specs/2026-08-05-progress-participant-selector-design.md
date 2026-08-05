# Progress Participant Selector Design

## Goal

Add a compact participant selector to the progress display so an operator can safely switch the display between participant-specific progress streams without manually editing or reloading the page URL.

This design supersedes only the earlier requirement that the progress page contain no selector. The large progress bar and `current/total` value remain the page's primary content.

## User Experience

A native dropdown appears near the top-right corner of the progress page. Its selected option shows the current participant as `Participant 01` through `Participant 36`.

The selector initializes from the existing `?participant=<ID>` query parameter. A missing, malformed, or out-of-range participant continues to default to participant 1.

Selecting an ID other than the active participant opens the browser's native confirmation dialog:

> Switch progress display from Participant 01 to Participant 02?

The participant numbers in the message use two digits.

- Confirming the dialog changes the active participant, updates the URL query parameter without reloading, clears the previous participant's progress, and begins polling the selected participant.
- Cancelling leaves the participant, URL, displayed progress, and polling target unchanged. Because the dropdown is controlled by the active participant state, it returns to the current selection.
- Selecting the already active participant performs no action and opens no dialog.

## Page Layout

The selector is visually compact and anchored near the viewport's top-right edge. It must remain legible and usable without competing with the centered progress bar and large numeric value. On narrow screens, its dimensions and page spacing adjust so it does not overlap or clip the progress content.

The page otherwise retains its existing visual design: full-viewport neutral background, large blue progress bar, and large centered `current/total` value. No participant heading, explanatory text, navigation, or connection status is added.

## State and URL Flow

The existing `participantId` React state remains the single source of truth for both the selected option and the polling effect.

On an approved change:

1. Normalize the selected value to the supported range of 1 through 36.
2. Construct a URL from the current browser location.
3. Set its `participant` query parameter to the selected ID while preserving the current pathname, unrelated query parameters, and hash.
4. Replace the current browser history entry with `window.history.replaceState`, avoiding both a page reload and an extra Back-button entry.
5. Set `participantId` to the approved ID.

The existing participant-dependent effect then cancels the old poller, resets visible progress to `0/0`, immediately requests the newly selected participant's latest state, and starts a new one-second polling interval. A successful response displays the selected participant's stored progress. A request failure leaves the reset value in place until a later poll succeeds, preventing the previous participant's progress from appearing under the new selection.

## Accessibility

Use a native `<select>` with an accessible participant label. Native keyboard operation and screen-reader semantics are preserved. The confirmation message explicitly names both the current and proposed participants so the decision is unambiguous.

The progress bar retains its existing `role="progressbar"`, numeric ARIA values, live numeric output, contrast, responsive sizing, and reduced-motion behavior.

## Error Handling

- Invalid participant values normalize to participant 1.
- Cancelling confirmation changes no application or browser state.
- URL replacement occurs only after confirmation.
- Progress-fetch errors remain silent and are retried by the existing polling loop.
- No synchronization request is sent merely because the display switches participants; the page only reads the selected participant's stored progress.

## Testing

Automated tests will verify that:

- The progress page renders a controlled participant selector with all 36 participant IDs.
- The selector is initialized from the URL-derived participant state.
- Selecting the active participant does not request confirmation or change state.
- Selecting another participant requests confirmation with both zero-padded IDs.
- Cancelling preserves the active participant and URL.
- Confirming replaces the `participant` query value without reloading and changes the polling target.
- Participant changes still reset the visible value before fetching the new participant.
- The existing progress display, one-second polling, and monotonic update behavior remain intact.

Manual verification will switch between at least two participants with different stored progress values. It will confirm both the cancellation and approval paths, the URL update, the absence of a page reload, and the correct progress value after the next successful poll.

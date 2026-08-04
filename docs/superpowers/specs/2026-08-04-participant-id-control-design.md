# Participant ID Control Design

## Goal

Replace the browser-native participant-ID dropdown with a compact, polished control suitable for running a 36-person study.

## Interaction

The control displays a zero-padded participant number in a blue gradient pill. Small increment and decrement buttons change the value by one and stop at 1 and 36. The selected value remains keyboard accessible and continues to use the existing `participantId` state, local storage persistence, and CSV attribution.

## Visual behavior

The card uses the console’s blue accent, a subtle inner highlight, and a short confirmation pulse whenever the value changes. The control remains compact in the header and reflows with the existing responsive toolbar rules.

## Verification

Tests will assert bounded increment/decrement behavior and accessibility labels. Lint and production build will run before preview.

# Shelf and Boba Participant Setup Design

## Scope

Update the shelf and boba workflows to use their supplied 15 correct AI instruction clips. Add a participant-ID control for the planned 36-participant study.

## Task data

Shelf and boba will each contain 15 correct steps. Their numbered audio files (`01` through `15`) will be copied from `~/Downloads/TaskPlanV2_audio` into the application’s public audio directory and associated one-to-one with those steps.

The task model will remain extensible for a later 20-step sequence. The five wrong instructions and their positions will not be shown or injected until the study’s participant-ID randomization rules are provided.

## Participant ID

The control console will include a compact numeric wheel selector ranging from 1 to 36. The selected participant ID is saved in local storage with the session and exported in every CSV event row. No randomization behavior depends on it in this release.

## Interaction and verification

AI audio playback and per-step Accept/Reject recording remain unchanged. Tests will assert both task counts, participant-ID bounds, persistence/export fields, and the absence of injected distractor steps. Lint, build, and the focused test will run; the currently unrelated legacy skeleton-test failures will be reported separately.

# Cue Text Updates and Challenge Audio Design

**Date:** 2026-08-13
**Status:** Approved for planning

## Overview

Two changes to the Wizard-of-Oz control console:

1. Revise the displayed text and spoken audio for several Shelf assembly and Boba tea
   cues, and add one missing recovery cue.
2. Change the Challenge button so it plays a distinct clip prefixed with
   "I think it's appropriate to" instead of replaying the verbatim cue audio.

The Challenge change applies to the Training, Shelf assembly, and Boba tea plans only.
Sandwich and Table assembly keep today's replay-verbatim behavior.

## Current Behavior

`app/page.tsx:1053` sets `challengeOption = task.correctOptions[0]`, the same
`InstructionOption` the AI audio button plays for a correct step. The Challenge button
therefore plays an identical audio file and differs only in its log label.

Audio sources are a mix of `.mp3` defaults derived from a folder/prefix convention and
`.wav` overrides declared in `randomizedTaskConfigs`. The override wins, so the file
that actually plays is not always the one the default naming implies.

## Audio Standards

All new clips are generated in the OpenAI TTS web UI with the settings used for the
existing assets:

```text
Model: gpt-4o-mini-tts
Voice: Nova
Speed: 1.00x
Response format: MP3
Instructions: Speak in professional way for a presentation in academic paper and user study
```

Every new file is `.mp3`. Cues currently stored as `.wav` are replaced by `.mp3` files
and the stale `.wav` files are deleted.

## Part 1: Cue Text and Content Audio

### Text changes in `app/page.tsx`

| Constant | Old | New |
|---|---|---|
| `shelfCorrectSteps[3]` | Insert another 2 pink at slot 3 and 4 | Insert another 2 pink at slot 3 and 4 of the yellow |
| `shelfDistractorSteps[0]` | Insert a purple at slot 3 of the yellow | Insert a purple piece at slot 3 of the yellow |
| `shelfDistractorRecoverySteps[0]` | remove the purple at slot3 | remove the purple piece at slot 3, because the size doesn't match |
| `shelfDistractorRecoverySteps[1]` | remove the pink at slot5 | remove the pink piece at slot 5, because the shape doesn't match |
| `shelfDistractorRecoverySteps[2]` | Remove the black piece | Remove the black piece, because the size doesn't match |
| `bobaDistractorSteps[0]` | add a little white sugar from the left bottle | add a little white sugar from the bottle on your left |
| `bobaDistractorRecoverySteps[0]` | *(empty)* | add a little white sugar from the bottle on your right |
| `bobaDistractorRecoverySteps[1]` | Put the fork back | Use a spoon to add matcha powder |
| `bobaDistractorSteps[2]` | Add a piece of lemon on the edge | Add a piece of lemon on the edge of the cup |
| `bobaDistractorRecoverySteps[2]` | Remove the lemon | Oh, please remove the lemon piece, because it's for delivery |

`shelfCorrectSteps[1]` ("Insert a green at slot 1 of the yellow") is left unchanged by
explicit decision.

Adding `bobaDistractorRecoverySteps[0]` makes the first Boba distractor render a
recovery cue and a Recover button for the first time; its audio resolves through
`recoveryAudioOverrides[0]`.

### Content clips to generate (10)

| # | Text to speak | Destination path |
|---|---|---|
| C01 | Insert another 2 pink at slot 3 and 4 of the yellow | `public/audio/shelf-assembly/shelf_04.mp3` |
| C02 | Insert a purple piece at slot 3 of the yellow | `public/audio/shelf-assembly-distractors/shelf_A.mp3` |
| C03 | remove the purple piece at slot 3, because the size doesn't match | `public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.mp3` |
| C04 | remove the pink piece at slot 5, because the shape doesn't match | `public/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.mp3` |
| C05 | Remove the black piece, because the size doesn't match | `public/audio/shelf-assembly-distractors/shelf_remove_black_piece.mp3` |
| C06 | add a little white sugar from the bottle on your left | `public/audio/boba-distractors/boba_A.mp3` |
| C07 | add a little white sugar from the bottle on your right | `public/audio/boba-distractors/boba_A_recovery.mp3` |
| C08 | Use a spoon to add matcha powder | `public/audio/boba-distractors/boba_use_spoon_matcha.mp3` |
| C09 | Add a piece of lemon on the edge of the cup | `public/audio/boba-distractors/boba_C.mp3` |
| C10 | Oh, please remove the lemon piece, because it's for delivery | `public/audio/boba-distractors/boba_remove_lemon.mp3` |

### Override map changes

```ts
// shelf recoveryAudioOverrides
0: "/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.mp3",
1: "/audio/shelf-assembly-distractors/shelf_remove_pink_slot5.mp3",
2: "/audio/shelf-assembly-distractors/shelf_remove_black_piece.mp3",

// boba recoveryAudioOverrides
0: "/audio/boba-distractors/boba_A_recovery.mp3",
1: "/audio/boba-distractors/boba_use_spoon_matcha.mp3",
2: "/audio/boba-distractors/boba_remove_lemon.mp3",
```

`boba` `distractorAudioOverrides[1]` keeps pointing at `boba_grab_fork.wav`; that cue's
text is unchanged.

### Files deleted

`shelf_remove_purple_slot3.wav`, `shelf_remove_pink_slot5.wav`, `shelf_return_black.wav`,
`put_fork_back.wav`, `boba_remove_lemon.wav`.

The unused `.mp3` recovery twins (`shelf_A_recovery.mp3`, `shelf_B_recovery.mp3`,
`shelf_C_recovery.mp3`, `boba_B_recovery.mp3`, `boba_C_recovery.mp3`) are shadowed by the
overrides and are left untouched — tests assert their presence. `boba_put_fork_down.wav`
is already unreferenced and is left as-is.

## Part 2: Challenge Audio

### Sentence rule

Every correct cue begins with an imperative verb, so one deterministic rule covers all
of them:

> `"I think it's appropriate to "` + cue text with its first letter lowercased + `"."`

### Path rule

The challenge clip for a cue is that cue's audio path with `_challenge.mp3` replacing its
extension. This survives Training's two separate `correctTasks` calls, which would collide
under index-based naming.

```text
/audio/shelf-assembly/shelf_01.mp3
  -> /audio/shelf-assembly/shelf_01_challenge.mp3
/audio/training/training_put_square_slot3.wav
  -> /audio/training/training_put_square_slot3_challenge.mp3
```

### Code changes

- Add `challengeOptions?: InstructionOption[]` to the `Task` type.
- `correctTasks()` takes a flag enabling challenge derivation. When set, each task gets a
  `challengeOptions[0]` whose `text` is the smoothed sentence and whose `audioSrc` is the
  derived path. Training, Shelf, and Boba pass the flag; Sandwich and Table do not.
- The Challenge button resolves `task.challengeOptions?.[0] ?? task.correctOptions[0]`, so
  plans without challenge clips keep current behavior with no separate code path.

The challenge sentence is not rendered as a visible cue chip. It appears in the button's
`aria-label` and `title` only, matching the current layout where the row lists the
correct, incorrect, and recovery cues.

### Challenge clips to generate (20)

Training:

| # | Text to speak | Destination path |
|---|---|---|
| T01 | I think it's appropriate to put a long piece on the ground. | `public/audio/training/training_01_challenge.mp3` |
| T02 | I think it's appropriate to put a square piece at slot 1. | `public/audio/training/training_02_challenge.mp3` |
| T03 | I think it's appropriate to put a square piece at slot 2. | `public/audio/training/training_03_challenge.mp3` |
| T04 | I think it's appropriate to put a square piece at slot 3. | `public/audio/training/training_put_square_slot3_challenge.mp3` |
| T05 | I think it's appropriate to put a square piece at slot 4. | `public/audio/training/training_put_square_slot4_challenge.mp3` |
| T06 | I think it's appropriate to put a long piece on the top. | `public/audio/training/training_put_long_piece_top_challenge.mp3` |

Shelf assembly:

| # | Text to speak | Destination path |
|---|---|---|
| S01 | I think it's appropriate to classify the pieces based on color. | `public/audio/shelf-assembly/shelf_01_challenge.mp3` |
| S02 | I think it's appropriate to insert a green at slot 1 of the yellow. | `public/audio/shelf-assembly/shelf_02_challenge.mp3` |
| S03 | I think it's appropriate to insert a pink piece at slot 2 of the yellow. | `public/audio/shelf-assembly/shelf_03_challenge.mp3` |
| S04 | I think it's appropriate to insert another 2 pink at slot 3 and 4 of the yellow. | `public/audio/shelf-assembly/shelf_04_challenge.mp3` |
| S05 | I think it's appropriate to insert a green piece at slot 5. | `public/audio/shelf-assembly/shelf_05_challenge.mp3` |
| S06 | I think it's appropriate to connect another yellow with the green and pink. | `public/audio/shelf-assembly/shelf_06_challenge.mp3` |
| S07 | I think it's appropriate to connect a blue piece with the 2 green. | `public/audio/shelf-assembly/shelf_07_challenge.mp3` |

Boba tea:

| # | Text to speak | Destination path |
|---|---|---|
| B01 | I think it's appropriate to add strawberry sugar syrup into a cup. | `public/audio/boba/boba_01_challenge.mp3` |
| B02 | I think it's appropriate to add boba. | `public/audio/boba/boba_02_challenge.mp3` |
| B03 | I think it's appropriate to add the yogurt as bottom layer. | `public/audio/boba/boba_03_challenge.mp3` |
| B04 | I think it's appropriate to pour matcha latte. | `public/audio/boba/boba_04_challenge.mp3` |
| B05 | I think it's appropriate to pour coconut milk. | `public/audio/boba/boba_05_challenge.mp3` |
| B06 | I think it's appropriate to add milk cream on the top. | `public/audio/boba/boba_06_challenge.mp3` |
| B07 | I think it's appropriate to put the lid on the cup. | `public/audio/boba/boba_07_challenge.mp3` |

## Generation Workflow

1. The user generates all 30 phrases (C01–C10, T01–T06, S01–S07, B01–B07) in the OpenAI
   TTS web UI using the settings above.
2. The user places the downloads in one folder, either renamed to the destination
   basenames or accompanied by the download order so each file maps to its row.
3. Claude moves each file to its destination path, deletes the superseded `.wav` files,
   updates `app/page.tsx`, and updates `tests/rendered-html.test.mjs`.
4. Claude runs `npm test` and verifies playback in the running app before committing.

Audio generation is a manual prerequisite: the asset-existence test fails until every
file is in place, so the clips land before the code and test changes that reference them.

## Testing

`tests/rendered-html.test.mjs` is the existing guard and extends naturally:

- Replace the stale cue-text assertions (`"remove the purple at slot3"`,
  `"Put the fork back"`, `"Remove the lemon"`, `"add a little white sugar from the left
  bottle"`, `"Insert a purple at slot 3 of the yellow"`, `"Add a piece of lemon on the
  edge"`) with the new strings, and add `doesNotMatch` assertions for the retired ones.
- Update the override-path assertions from `.wav` to the new `.mp3` paths.
- Extend the asset-existence list with all 30 new files and drop the five deleted `.wav`s.
- Add an assertion that the Challenge button resolves `challengeOptions` with a fallback
  to `correctOptions[0]`, and that Sandwich and Table declare no challenge audio.

Manual verification: in each of Training, Shelf, and Boba, play a correct step's AI audio
and then its Challenge button and confirm the two differ; play the first Boba distractor
and confirm its new Recover button speaks the right-bottle line.

## Out of Scope

- Sandwich and Table assembly challenge audio.
- Removing the shadowed `.mp3` recovery twins or `boba_put_fork_down.wav`.
- Rendering the challenge sentence as a visible cue chip.
- Any change to logging, progress sync, or distractor placement logic.

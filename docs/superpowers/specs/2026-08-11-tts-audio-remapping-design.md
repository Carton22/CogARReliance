# OpenAI TTS Audio Remapping Design

## Goal

Replace the requested training, shelf-distractor, and boba-distractor audio cues with newly generated OpenAI Text-to-Speech WAV files. Every configured audio source must speak the exact text displayed by the control console.

## Scope

The change covers these nine unique spoken texts:

1. `Put a long piece on the top`
2. `Put a square piece at slot 3`
3. `Put a square piece at slot 4`
4. `remove the purple at slot3`
5. `remove the pink at slot5`
6. `Return the black`
7. `Grab a fork`
8. `Put the fork down`
9. `Remove the lemon`

Training steps 4 and 7 display the same text, `Put a long piece on the top`, so they will intentionally reference the same newly generated audio asset. The training recovery cue `Take the long piece down` is outside this replacement scope and remains unchanged.

The shelf recovery text `Remove the purple` will be changed to the exact requested string `remove the purple at slot3`.

## Audio Generation

Generate each unique phrase through the OpenAI Text-to-Speech page already open in Chrome. Preserve the currently selected settings shown in the page: `gpt-4o-mini-tts`, Nova voice, 1.00x speed, WAV response format, and the existing professional academic-presentation speaking instruction.

Download one WAV file per unique text. Use descriptive, stable filenames instead of relying on the browser's generated download names:

- `training_put_long_piece_top.wav`
- `training_put_square_slot3.wav`
- `training_put_square_slot4.wav`
- `shelf_remove_purple_slot3.wav`
- `shelf_remove_pink_slot5.wav`
- `shelf_return_black.wav`
- `boba_grab_fork.wav`
- `boba_put_fork_down.wav`
- `boba_remove_lemon.wav`

Store each file in the existing audio folder for its cue family:

- Training files in `public/audio/training/`
- Shelf distractor/recovery files in `public/audio/shelf-assembly-distractors/`
- Boba distractor/recovery files in `public/audio/boba-distractors/`

## Application Mapping

Update `app/page.tsx` so each affected instruction option has an explicit audio source that points to the matching descriptive WAV file.

- Training step 4 incorrect cue and training step 7 correct cue share `training_put_long_piece_top.wav`.
- Training steps 5 and 6 point to the slot 3 and slot 4 WAV files respectively.
- Shelf distractor A recovery uses the new `remove the purple at slot3` text and corresponding WAV.
- Shelf distractor B recovery and C recovery use their corresponding new WAV files.
- Boba distractor B and its recovery use the new fork WAV files.
- Boba distractor C recovery uses the new lemon WAV file.

Existing task randomization, distractor placement, event logging, recovery behavior, and all unaffected audio mappings remain unchanged.

## Verification

Add or update automated tests before application changes so they fail against the current mappings. Tests will assert the exact displayed text and audio source for every affected cue, including the intentional shared source for the identical training step 4/7 phrase.

After implementation:

1. Validate each downloaded file as a non-empty WAV audio file.
2. Run the focused unit tests and observe them pass.
3. Run the complete test suite, lint, and production build.
4. Inspect the built or locally rendered console to confirm the affected text and source paths are present.
5. Play each affected cue in the browser and confirm its speech matches the displayed text.

## Repository Safety

Implement this work in the clean `carton22/CogARReliance` checkout at `CogARReliance-site`. Do not alter or overwrite the unrelated uncommitted work in the existing `CogARReliance` directory, which is connected to `carton22/CogARAnnotate`.

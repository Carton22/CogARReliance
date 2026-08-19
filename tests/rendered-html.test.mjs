import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("uses AI audio, Challenge / Recover, Accept, Reject, and Step Complete as the matrix columns", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<div role="columnheader">AI audio<\/div>/);
  assert.match(page, /<div role="columnheader">Challenge \/ Recover<\/div>/);
  assert.match(page, /<div role="columnheader">Accept<\/div>/);
  assert.match(page, /<div role="columnheader">Reject<\/div>/);
  assert.match(page, /<div role="columnheader">Step Complete<\/div>/);
  assert.match(page, /markDecision\(/);
  assert.match(page, /stepComplete\?: boolean/);
  assert.match(page, /markStepComplete\(/);
  assert.match(page, /addLog\([\s\S]*"complete",[\s\S]*"Task step completion marker"/);
  assert.doesNotMatch(page, /"incomplete"/);
  assert.doesNotMatch(
    page,
    /User act start|User act end|App Rely|Over Rely|Under Rely|App Reject/,
  );
});

test("uses training plus 7-step study scripts with participant IDs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /participantId/);
  assert.match(page, /Array\.from\(\{ length: 36 \}/);
  assert.match(page, /id: "training"/);
  assert.match(page, /trainingCorrectSteps = \[/);
  assert.match(page, /trainingTasks = \[/);
  assert.match(page, /sandwichCorrectSteps = \[/);
  assert.match(page, /shelfCorrectSteps = \[/);
  assert.match(page, /bobaCorrectSteps = \[/);
  assert.match(page, /tableCorrectSteps = \[/);
  assert.match(page, /tasks: withBoundaryTasks\(trainingTasks\)/);
  assert.match(page, /correctTasks\(sandwichCorrectSteps, "sandwich", "sandwich"\)/);
  assert.match(page, /correctTasks\(\s*shelfCorrectSteps,\s*"shelf-assembly",\s*"shelf",\s*\{\},\s*0,\s*shelfAssistiveByCorrectStep,\s*\)/);
  assert.match(page, /correctTasks\(\s*bobaCorrectSteps,\s*"boba",\s*"boba",\s*\{\},\s*2,\s*bobaAssistiveByCorrectStep,\s*\)/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly"\)/);
});

test("adds logged challenge audio for numbered correct instruction rows", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /task\.mainKind === "correct" && !task\.decisionDisabled/);
  assert.match(
    page,
    /const challengeOption =\s*task\.challengeOptions\?\.\[0\] \?\? task\.correctOptions\[0\]/,
  );
  assert.match(page, /circle-button challenge-button/);
  assert.match(page, /assistiveOptions\?: InstructionOption\[\]/);
  assert.match(page, /cue-button cue-assistive/);
  assert.match(page, /legend-assistive/);
  assert.match(
    page,
    /playInstruction\([\s\S]*challengeOption,[\s\S]*"correct",[\s\S]*"challenge",[\s\S]*true,[\s\S]*"challenge",[\s\S]*false,?\s*\)/,
  );
  assert.match(page, /aria-label=\{`Play challenge audio for task \$\{taskNumber\}: \$\{challengeOption\.text\}`\}/);
  assert.match(page, /title=\{`Play challenge instruction: \$\{challengeOption\.text\}`\}/);
  assert.match(page, /<small>Challenge<\/small>/);
  assert.match(css, /\.challenge-button\s*\{/);
  assert.match(css, /\.challenge-button\.is-playing\s*\{/);
  assert.match(css, /\.recovery-button\s*\{/);
});

test("inserts the misleading training top-piece step between steps 3 and 4", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /trainingTasks/);
  assert.match(
    page,
    /correctTasks\(trainingCorrectSteps\.slice\(0, 3\), "training", "training", \{\}, 1\)/,
  );
  assert.match(page, /name: "Put a long piece on the top"/);
  assert.match(page, /incorrectOptions: \[/);
  assert.match(
    page,
    /text: "Put a long piece on the top",\s+audioSrc: "\/audio\/training\/training_put_long_piece_top\.wav"/,
  );
  assert.match(page, /text: "Take the long piece down"/);
  assert.match(page, /audioSrc: "\/audio\/training\/training_top_recovery\.wav"/);
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
  assert.match(page, /correctTasks\(trainingCorrectSteps\.slice\(3\), "training", "training"/);
  assert.match(
    page,
    /correctTasks\(trainingCorrectSteps\.slice\(3\), "training", "training", \{[^)]*\}, 4\)/,
  );
  assert.match(
    page,
    /tasks: withBoundaryTasks\(trainingTasks\)/,
  );
});

test("allows training in progress sync validators", async () => {
  const [progressSync, script] = await Promise.all([
    readFile(new URL("../app/progress-sync.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/google-sheets-sync.gs", import.meta.url), "utf8"),
  ]);

  assert.match(progressSync, /new Set\(\["training", "sandwich", "shelf", "boba", "table"\]\)/);
  assert.match(script, /\["training", "sandwich", "shelf", "boba", "table"\]/);
});

test("adds logged task boundary rows without accept or reject decisions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /withBoundaryTasks/);
  assert.match(page, /numberedTasks = tasks\.map/);
  assert.match(page, /sequenceNumber: index \+ 1/);
  assert.match(page, /name: "Task begin"/);
  assert.match(page, /audioSrc: "\/audio\/session\/task_begin\.mp3"/);
  assert.match(page, /text: "Yes"/);
  assert.match(page, /audioSrc: "\/audio\/assistive\/task-begin\/yes\.wav"/);
  assert.match(page, /text: "No"/);
  assert.match(page, /audioSrc: "\/audio\/assistive\/task-begin\/no\.wav"/);
  assert.match(page, /actionLabel: "start"/);
  assert.match(page, /name: "Task complete"/);
  assert.match(page, /audioSrc: "\/audio\/session\/task_complete\.mp3"/);
  assert.match(page, /actionLabel: "complete"/);
  assert.match(page, /task\.decisionDisabled/);
  assert.match(page, /return <div role="cell" className="action-cell is-empty" key=\{decision\} \/>/);
  assert.match(page, /playInstruction\([\s\S]*task\.actionLabel \?\? "AI audio"/);
  assert.match(page, /task\.sequenceNumber \? String\(task\.sequenceNumber\)\.padStart\(2, "0"\) : ""/);
  assert.match(page, /task: plan\.tasks\[task - 1\]\?\.sequenceNumber \?\? ""/);
});

test("uses a bounded participant dropdown and a cross for recorded rejection", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /className="participant-dropdown"/);
  assert.match(page, /Array\.from\(\{ length: 36 \}/);
  assert.match(page, /handleParticipantIdChange/);
  assert.match(page, /onChange=\{\(event\) => handleParticipantIdChange\(Number\(event\.target\.value\)\)\}/);
  assert.match(page, /setParticipantId\(nextParticipantId\)/);
  assert.match(page, /setTaskState\(emptyTaskState\(\)\)/);
  assert.match(page, /setLogs\(\[\]\)/);
  assert.match(page, /decision === "reject" \? "×" : "✓"/);
});

test("injects three participant-stable distractors only between the allowed 2-step blocks", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const DISTRACTOR_INSERT_WINDOWS = \[/);
  assert.match(page, /label: "A", allowedAfterCorrectSteps: \[1, 2, 3\]/);
  assert.match(page, /label: "B", allowedAfterCorrectSteps: \[3, 4, 5\]/);
  assert.match(page, /label: "C", allowedAfterCorrectSteps: \[5, 6, 7\]/);
  assert.match(page, /insertAfterCorrectStep/);
  assert.match(page, /buildDistractorBuckets/);
  assert.doesNotMatch(page, /blockIndex \* 3/);
  assert.match(page, /distractors: \["A", "B", "C"\]/);
  assert.doesNotMatch(page, /distractors: \["A", "B", "C", "D", "E"\]/);
  assert.doesNotMatch(page, /Array\.from\(\{ length: 5 \}, \(_, blockIndex\)/);
  assert.match(page, /sandwichDistractorSteps = \[/);
  assert.match(page, /"Add peppers"/);
  assert.match(page, /"Add the green celery"/);
  assert.match(page, /"Add water into a cup"/);
  assert.match(page, /shelfDistractorSteps = \[/);
  assert.match(page, /"Insert side A of a purple piece into slot 3 of the yellow"/);
  assert.doesNotMatch(page, /"Insert a purple piece at slot 3 of the yellow"/);
  assert.match(page, /"Insert a brown piece at slot 5"/);
  assert.doesNotMatch(page, /"Insert a pink piece at slot 5"/);
  assert.match(page, /"Connect the black piece with side B of 2 green pieces"/);
  assert.doesNotMatch(page, /"Connect the black piece with the 2 green pieces"/);
  assert.doesNotMatch(page, /"Connect a blue piece with the 2 green"/);
  assert.match(
    page,
    /const shelfCorrectSteps = \[[^\]]*"Connect the blue piece with side B of 2 green pieces"[^\]]*\];/,
  );
  assert.doesNotMatch(
    page,
    /const shelfCorrectSteps = \[[^\]]*"Connect the black piece with side B of 2 green pieces"[^\]]*\];/,
  );
  assert.match(page, /"Connect No\.2 yellow piece with the greens and pinks"/);
  assert.doesNotMatch(page, /"Connect another yellow piece with the greens and pinks"/);
  assert.doesNotMatch(page, /"Connect a black with the 2 green"/);
  assert.doesNotMatch(page, /"Connect another yellow with the green and pink"/);
  assert.match(page, /shelfDistractorRecoverySteps = \[/);
  assert.match(page, /"remove the purple piece at slot 3, because the size doesn't match"/);
  assert.match(page, /"remove the brown piece at slot 5, because the shape doesn't match"/);
  assert.doesNotMatch(page, /"remove the pink piece at slot 5, because the shape doesn't match"/);
  assert.match(page, /"Remove the black piece, because the size doesn't match"/);
  assert.match(page, /bobaDistractorSteps = \[/);
  assert.match(page, /"grab the left bottle to add white sugar"/);
  assert.match(page, /"grab the right bottle to add white sugar"/);
  assert.doesNotMatch(page, /"add a little white sugar from the bottle on your left"/);
  assert.doesNotMatch(page, /"add a little white sugar from the bottle on your right"/);
  assert.match(page, /"use a fork to add matcha powder"/);
  assert.doesNotMatch(page, /"Mix up the current cup"/);
  assert.match(page, /"Insert a white straw"/);
  assert.match(page, /bobaDistractorRecoverySteps = \[/);
  assert.match(page, /"Use a spoon to add matcha powder"/);
  assert.match(page, /"Oh, replace the straw with a bigger black straw for boba"/);
  assert.doesNotMatch(page, /"Oh, please remove the lemon piece, because the boba tea is for delivery"/);
  assert.doesNotMatch(page, /"Oh, please remove the lemon piece, because it's for delivery"/);
  assert.match(page, /"Add strawberry yogurt into the cup"/);
  assert.doesNotMatch(page, /"Add strawberry yogurt as the bottom layer"/);
  assert.match(page, /"Pour matcha latte into the cup"/);
  assert.match(page, /"Pour coconut milk into the cup"/);
  assert.match(page, /"Put a lid on the cup"/);
  assert.doesNotMatch(page, /"Add the yogurt as bottom layer"/);
  assert.doesNotMatch(page, /"Pour matcha latte",/);
  assert.doesNotMatch(page, /"Pour coconut milk",/);
  assert.doesNotMatch(page, /"Put the lid on the cup"/);
  assert.doesNotMatch(page, /"Remove the lemon"/);
  assert.doesNotMatch(page, /"Add a piece of lemon on the edge"/);
  assert.match(page, /bobaAssistiveByCorrectStep/);
  assert.match(page, /bobaAssistiveByDistractorStep/);
  assert.match(page, /shelfAssistiveByCorrectStep/);
  assert.match(page, /shelfAssistiveByDistractorStep/);
  assert.match(page, /"Keep adding more"/);
  assert.match(page, /"You can add all of them"/);
  assert.match(page, /"add half of them"/);
  assert.match(page, /audioSrc: "\/audio\/assistive\/boba\/add_half_of_them\.mp3"/);
  assert.match(page, /"Stop pouring"/);
  assert.match(page, /"Insert side A of a green into slot 1 of the yellow"/);
  assert.match(page, /"Insert side A of a green into slot 5 of the yellow"/);
  assert.doesNotMatch(page, /"Insert a green at slot 1 of the yellow"/);
  assert.doesNotMatch(page, /"Insert a green piece at slot 5"/);
  assert.match(page, /"Just connect with No\.1 Yellow piece"/);
  assert.match(page, /connect_no1_yellow_piece\.wav/);
  assert.match(page, /"Turn and insert the other side A of the green"/);
  assert.doesNotMatch(page, /"Turn and insert the other side of the green"/);
  assert.match(page, /"should connect with side B of the green pieces"/);
  assert.doesNotMatch(page, /"Should connect between 2 yellow pieces"/);
  assert.match(page, /recoveryOptions/);
  assert.match(page, /Recovery audio/);
  assert.match(page, /\$\{config\.prefix\}_\$\{distractor\}_recovery\.mp3/);
  assert.match(page, /"Insert another 2 pink at slot 3 and 4 of the yellow"/);
  assert.doesNotMatch(page, /"Insert a purple at slot 3 of the yellow"/);
  assert.doesNotMatch(page, /"remove the purple at slot3"/);
  assert.doesNotMatch(page, /"remove the pink at slot5"/);
  assert.doesNotMatch(page, /"add a little white sugar from the left bottle"/);
  assert.doesNotMatch(page, /"Put the fork back"/);
  assert.match(page, /tableCorrectSteps = \[/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly"\)/);
  assert.match(page, /tableDistractorSteps = \[/);
  assert.match(page, /"Take a cutting knife"/);
  assert.match(page, /"Connect a No\.5 with a No\.9"/);
  assert.match(page, /"Connect a No\.6 with a No\.8"/);
  assert.doesNotMatch(page, /Play distractor instruction/);
});

test("maps requested shelf and boba cues to matching TTS audio", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(page, /"Remove the purple"/);
  assert.match(
    page,
    /0: "\/audio\/shelf-assembly-distractors\/shelf_remove_purple_slot3\.mp3"/,
  );
  assert.match(
    page,
    /1: "\/audio\/shelf-assembly-distractors\/shelf_insert_brown_slot5\.wav"/,
  );
  assert.match(
    page,
    /1: "\/audio\/shelf-assembly-distractors\/shelf_remove_brown_slot5\.wav"/,
  );
  assert.match(
    page,
    /2: "\/audio\/shelf-assembly-distractors\/shelf_remove_black_piece\.mp3"/,
  );
  assert.match(
    page,
    /1: "\/audio\/boba-distractors\/boba_grab_fork\.wav"/,
  );
  assert.match(
    page,
    /0: "\/audio\/boba-distractors\/boba_A_recovery\.mp3"/,
  );
  assert.match(
    page,
    /1: "\/audio\/boba-distractors\/boba_use_spoon_matcha\.mp3"/,
  );
  assert.match(
    page,
    /2: "\/audio\/boba-distractors\/boba_insert_white_straw\.wav"/,
  );
  assert.match(
    page,
    /2: "\/audio\/boba-distractors\/boba_replace_black_straw\.wav"/,
  );
  assert.doesNotMatch(page, /boba_remove_lemon\.mp3/);
  assert.doesNotMatch(page, /shelf_return_black\.wav/);
  assert.doesNotMatch(page, /put_fork_back\.wav/);
});

test("has audio assets for training and configured wrong suggestions", async () => {
  const files = [
    "../public/audio/training/training_01.mp3",
    "../public/audio/training/training_02.mp3",
    "../public/audio/training/training_03.mp3",
    "../public/audio/training/training_04.mp3",
    "../public/audio/training/training_05.mp3",
    "../public/audio/training/training_06.mp3",
    "../public/audio/training/training_top_recovery.wav",
    "../public/audio/training/training_put_long_piece_top.wav",
    "../public/audio/training/training_put_square_slot3.wav",
    "../public/audio/training/training_put_square_slot4.wav",
    "../public/audio/sandwich-distractors/sandwich_A.mp3",
    "../public/audio/sandwich-distractors/sandwich_B.mp3",
    "../public/audio/sandwich-distractors/sandwich_C.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_A.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_A_recovery.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_B.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_B_recovery.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_C.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_C_recovery.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_remove_purple_slot3.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_insert_brown_slot5.wav",
    "../public/audio/shelf-assembly-distractors/shelf_remove_brown_slot5.wav",
    "../public/audio/shelf-assembly-distractors/shelf_remove_black_piece.mp3",
    "../public/audio/boba-distractors/boba_A.mp3",
    "../public/audio/boba-distractors/boba_B.mp3",
    "../public/audio/boba-distractors/boba_B_recovery.mp3",
    "../public/audio/boba-distractors/boba_C.mp3",
    "../public/audio/boba-distractors/boba_C_recovery.mp3",
    "../public/audio/boba-distractors/boba_grab_fork.wav",
    "../public/audio/boba-distractors/boba_A_recovery.mp3",
    "../public/audio/boba-distractors/boba_use_spoon_matcha.mp3",
    "../public/audio/boba-distractors/boba_insert_white_straw.wav",
    "../public/audio/boba-distractors/boba_replace_black_straw.wav",
    "../public/audio/assistive/shelf/connect_no1_yellow_piece.wav",
    "../public/audio/assistive/shelf/turn_green_other_side.wav",
    "../public/audio/assistive/shelf/nice_keep_going.wav",
    "../public/audio/assistive/shelf/connect_between_yellow_pieces.wav",
    "../public/audio/assistive/task-begin/yes.wav",
    "../public/audio/assistive/task-begin/no.wav",
    "../public/audio/assistive/boba/keep_adding_more.wav",
    "../public/audio/assistive/boba/stop.wav",
    "../public/audio/assistive/boba/add_a_bit_more.wav",
    "../public/audio/assistive/boba/you_can_stop_now.wav",
    "../public/audio/assistive/boba/you_can_add_all.wav",
    "../public/audio/assistive/boba/add_half_of_them.mp3",
    "../public/audio/assistive/boba/add_more.wav",
    "../public/audio/assistive/boba/stop_adding.wav",
    "../public/audio/assistive/boba/keep_pouring.wav",
    "../public/audio/assistive/boba/stop_now.wav",
    "../public/audio/assistive/boba/you_can_add_more.wav",
    "../public/audio/assistive/boba/enough_now.wav",
    "../public/audio/assistive/boba/stop_pouring.wav",
    "../public/audio/assistive/boba/good_now.wav",
    "../public/audio/table-assembly-distractors/table_assembly_A.mp3",
    "../public/audio/table-assembly-distractors/table_assembly_B.mp3",
    "../public/audio/table-assembly-distractors/table_assembly_C.mp3",
    "../public/audio/shelf-assembly/shelf_04.mp3",
    "../public/audio/training/training_01_challenge.mp3",
    "../public/audio/training/training_02_challenge.mp3",
    "../public/audio/training/training_03_challenge.mp3",
    "../public/audio/training/training_put_square_slot3_challenge.mp3",
    "../public/audio/training/training_put_square_slot4_challenge.mp3",
    "../public/audio/training/training_put_long_piece_top_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_01_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_02_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_03_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_04_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_05_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_06_challenge.mp3",
    "../public/audio/shelf-assembly/shelf_07_challenge.mp3",
    "../public/audio/boba/boba_01_challenge.mp3",
    "../public/audio/boba/boba_02_challenge.mp3",
    "../public/audio/boba/boba_03_challenge.mp3",
    "../public/audio/boba/boba_04_challenge.mp3",
    "../public/audio/boba/boba_05_challenge.mp3",
    "../public/audio/boba/boba_06_challenge.mp3",
    "../public/audio/boba/boba_07_challenge.mp3",
  ];

  await Promise.all(
    files.map((file) => access(new URL(file, import.meta.url))),
  );
});

test("supports real-time Google Sheets event sync", async () => {
  const [page, script] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/google-sheets-sync.gs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /sheetSyncUrl/);
  assert.match(page, /Google Sheets sync/);
  assert.match(page, /fetch\(sheetSyncUrl/);
  assert.match(page, /mode: "no-cors"/);
  assert.match(page, /credentials: "include"/);
  assert.match(page, /DEFAULT_SHEET_SYNC_URL/);
  assert.match(page, /stepName/);
  assert.match(script, /function doPost\(event\)/);
  assert.match(script, /function doGet\(event\)/);
  assert.match(script, /participantSheetName/);
  assert.match(script, /insertSheet/);
  assert.match(script, /appendRow/);
  assert.match(script, /participant_id/);
  assert.match(script, /"step"/);
  assert.doesNotMatch(script, /"task"/);
  assert.doesNotMatch(script, /"recorded_at_iso"/);
  assert.doesNotMatch(script, /"log_id"/);
  assert.doesNotMatch(script, /"elapsed_seconds"/);
  assert.doesNotMatch(script, /"elapsed_label"/);
});

test("derives challenge audio for training, shelf, and boba only", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /challengeOptions\?: InstructionOption\[\]/);
  assert.match(page, /function toChallengeOption\(\s*option: InstructionOption,\s*prefixIndex: number,\s*\)/);
  assert.match(
    page,
    /\$\{CHALLENGE_PREFIXES\[prefixIndex % CHALLENGE_PREFIXES\.length\]\} \$\{option\.text\.charAt\(0\)\.toLowerCase\(\)\}\$\{option\.text\.slice\(1\)\}\./,
  );
  assert.match(page, /replace\(\/\\\.\[\^\.\/\]\+\$\/, ""\)/);
  assert.match(page, /_challenge\.mp3/);
  assert.match(page, /challengePrefixOffset\?: number/);
  assert.match(
    page,
    /challengePrefixOffset === undefined\s*\? \{\}\s*: \{ challengeOptions: \[toChallengeOption\(option, challengePrefixOffset \+ index\)\] \}/,
  );
  assert.match(page, /correctTasks\(trainingCorrectSteps\.slice\(0, 3\), "training", "training", \{\}, 1\)/);
  assert.match(page, /correctTasks\(trainingCorrectSteps\.slice\(3\), "training", "training", \{[^)]*\}, 4\)/);
  assert.match(page, /correctTasks\(\s*shelfCorrectSteps,\s*"shelf-assembly",\s*"shelf",\s*\{\},\s*0,\s*shelfAssistiveByCorrectStep,\s*\)/);
  assert.match(page, /correctTasks\(\s*bobaCorrectSteps,\s*"boba",\s*"boba",\s*\{\},\s*2,\s*bobaAssistiveByCorrectStep,\s*\)/);
  assert.match(page, /correctTasks\(sandwichCorrectSteps, "sandwich", "sandwich"\)/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly"\)/);
  assert.doesNotMatch(page, /correctTasks\(sandwichCorrectSteps, "sandwich", "sandwich", \{\},/);
  assert.doesNotMatch(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly", \{\},/);
});

test("offers four confidence-matched challenge prefixes", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const CHALLENGE_PREFIXES = \[/);
  assert.match(page, /"I think it's appropriate to"/);
  assert.match(page, /"I checked again, and it is good to"/);
  assert.match(page, /"I would suggest you"/);
  assert.match(page, /"My recommendation is still to"/);
  // The single-prefix constant is retired; nothing may reference it.
  assert.doesNotMatch(page, /CHALLENGE_PREFIX\b(?!ES)/);
});

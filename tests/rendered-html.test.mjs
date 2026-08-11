import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("uses AI audio, Accept, Reject, and Step Complete as the matrix columns", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<div role="columnheader">AI audio<\/div>/);
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

test("uses training plus 7-correct-step study scripts with participant IDs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /participantId/);
  assert.match(page, /Array\.from\(\{ length: 36 \}/);
  assert.match(page, /id: "training"/);
  assert.match(page, /trainingCorrectSteps = \[/);
  assert.match(page, /sandwichCorrectSteps = \[/);
  assert.match(page, /shelfCorrectSteps = \[/);
  assert.match(page, /bobaCorrectSteps = \[/);
  assert.match(page, /tableCorrectSteps = \[/);
  assert.match(page, /correctTasks\(trainingCorrectSteps, "training", "training", trainingAudioOverrides\)/);
  assert.match(page, /correctTasks\(sandwichCorrectSteps, "sandwich", "sandwich"\)/);
  assert.match(page, /correctTasks\(shelfCorrectSteps, "shelf-assembly", "shelf"\)/);
  assert.match(page, /correctTasks\(bobaCorrectSteps, "boba", "boba"\)/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly"\)/);
});

test("inserts the training slot 4 step after the original fourth training action", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(
    page,
    /"Put a square piece at slot 3",\s*"Put a square piece at slot 4",\s*"Put a long piece on the top"/,
  );
  assert.match(page, /trainingAudioOverrides/);
  assert.match(page, /4: "\/audio\/training\/training_slot4\.mp3"/);
  assert.match(
    page,
    /correctTasks\(trainingCorrectSteps, "training", "training", trainingAudioOverrides\)/,
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
  assert.match(page, /"Insert a purple at slot 3 of the yellow"/);
  assert.match(page, /"Insert a pink piece at slot 5"/);
  assert.match(page, /"Take a black piece"/);
  assert.match(page, /shelfDistractorRecoverySteps = \[/);
  assert.match(page, /"Remove the purple"/);
  assert.match(page, /"Remove the pink"/);
  assert.match(page, /"Return the black"/);
  assert.match(page, /bobaDistractorSteps = \[/);
  assert.match(page, /"Add white sugar to the cup"/);
  assert.match(page, /"Grab a fork"/);
  assert.doesNotMatch(page, /"Mix up the current cup"/);
  assert.match(page, /"Add a piece of lemon on the edge"/);
  assert.match(page, /bobaDistractorRecoverySteps = \[/);
  assert.match(page, /"Put the fork down"/);
  assert.match(page, /"Remove the lemon"/);
  assert.match(page, /recoveryOptions/);
  assert.match(page, /Recovery audio/);
  assert.match(page, /\$\{config\.prefix\}_\$\{distractor\}_recovery\.mp3/);
  assert.match(page, /tableCorrectSteps = \[/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "table_assembly"\)/);
  assert.match(page, /tableDistractorSteps = \[/);
  assert.match(page, /"Take a cutting knife"/);
  assert.match(page, /"Connect a No\.5 with a No\.9"/);
  assert.match(page, /"Connect a No\.6 with a No\.8"/);
  assert.doesNotMatch(page, /Play distractor instruction/);
});

test("has audio assets for training and configured wrong suggestions", async () => {
  const files = [
    "../public/audio/training/training_01.mp3",
    "../public/audio/training/training_02.mp3",
    "../public/audio/training/training_03.mp3",
    "../public/audio/training/training_04.mp3",
    "../public/audio/training/training_slot4.mp3",
    "../public/audio/training/training_05.mp3",
    "../public/audio/training/training_06.mp3",
    "../public/audio/sandwich-distractors/sandwich_A.mp3",
    "../public/audio/sandwich-distractors/sandwich_B.mp3",
    "../public/audio/sandwich-distractors/sandwich_C.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_A.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_A_recovery.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_B.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_B_recovery.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_C.mp3",
    "../public/audio/shelf-assembly-distractors/shelf_C_recovery.mp3",
    "../public/audio/boba-distractors/boba_A.mp3",
    "../public/audio/boba-distractors/boba_B.mp3",
    "../public/audio/boba-distractors/boba_B_recovery.mp3",
    "../public/audio/boba-distractors/boba_C.mp3",
    "../public/audio/boba-distractors/boba_C_recovery.mp3",
    "../public/audio/table-assembly-distractors/table_assembly_A.mp3",
    "../public/audio/table-assembly-distractors/table_assembly_B.mp3",
    "../public/audio/table-assembly-distractors/table_assembly_C.mp3",
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses AI audio, Accept, and Reject as the matrix decision columns", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<div role="columnheader">AI audio<\/div>/);
  assert.match(page, /<div role="columnheader">Accept<\/div>/);
  assert.match(page, /<div role="columnheader">Reject<\/div>/);
  assert.match(page, /markDecision\(/);
  assert.doesNotMatch(
    page,
    /User act start|User act end|App Rely|Over Rely|Under Rely|App Reject/,
  );
});

test("uses 15-step shelf and boba scripts with participant IDs", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /participantId/);
  assert.match(page, /Array\.from\(\{ length: 36 \}/);
  assert.match(page, /shelfCorrectSteps = \[/);
  assert.match(page, /bobaCorrectSteps = \[/);
  assert.match(page, /correctTasks\(shelfCorrectSteps, "shelf-assembly", "shelf"\)/);
  assert.match(page, /correctTasks\(bobaCorrectSteps, "boba", "boba"\)/);
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

test("injects fixed-order distractors with prompt text matching audio", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /shelfDistractorSteps = \[/);
  assert.match(page, /"Take a scissors"/);
  assert.match(page, /"Insert a purple piece at slot 3"/);
  assert.match(page, /"Insert a pink piece at slot 5"/);
  assert.match(page, /"Take a black piece"/);
  assert.match(page, /"Take a marker pen"/);
  assert.match(page, /bobaDistractorSteps = \[/);
  assert.match(page, /"Add white sugar to the cup"/);
  assert.match(page, /"Take one more plate"/);
  assert.match(page, /"Put a piece of lemon on the edge of the cup"/);
  assert.match(page, /"Pour out 25% portion of the first cup into the trash can"/);
  assert.match(page, /"Stir the cup"/);
  assert.match(page, /tableCorrectSteps = \[/);
  assert.match(page, /correctTasks\(tableCorrectSteps, "table-assembly", "task_assembly"\)/);
  assert.match(page, /tableDistractorSteps = \[/);
  assert.match(page, /"Insert a number seven piece at slot two of a number three piece"/);
  assert.match(page, /"Take a number seven piece"/);
  assert.match(page, /"Connect a number five piece with a number nine piece"/);
  assert.match(page, /"Connect a number six piece with a number eight piece"/);
  assert.match(page, /"Take a cutting knife"/);
  assert.match(page, /const distractor = config\.distractors\[blockIndex\]/);
  assert.doesNotMatch(page, /Play distractor instruction/);
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("links the selected participant to the separate progress route in the same tab", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /href=\{`\$\{PUBLIC_BASE_PATH\}\/progress\?participant=\$\{participantId\}`\}/);
  assert.match(page, />Participant display<\/a>/);
  assert.doesNotMatch(page, /target=["']_blank["']/);
});

test("publishes progress only from recorded AI audio playback", async () => {
  const page = await readFile(pageUrl, "utf8");
  const playStart = page.indexOf("const playInstruction");
  const playEnd = page.indexOf("const markDecision", playStart);
  const playInstruction = page.slice(playStart, playEnd);
  const recordStart = playInstruction.indexOf("if (shouldRecord)");
  assert.ok(recordStart > 0);
  assert.match(playInstruction.slice(recordStart), /publishActiveProgress\(taskNumber\)/);
  assert.doesNotMatch(playInstruction.slice(0, recordStart), /publishActiveProgress/);
  assert.match(page, /optionIndex,\s*false,/);
});

test("initializes and resets the active plan at step zero", async () => {
  const page = await readFile(pageUrl, "utf8");
  const hydrationStart = page.indexOf("if (!hydrated) return;", page.indexOf("const activeState"));
  const hydrationEnd = page.indexOf("}, [activePlanIndex, hydrated, participantId]);", hydrationStart);
  assert.ok(hydrationStart > 0 && hydrationEnd > hydrationStart);
  assert.match(page.slice(hydrationStart, hydrationEnd), /currentStep:\s*0/);
  const resetStart = page.indexOf("const resetSession");
  const resetEnd = page.indexOf("const handleParticipantIdChange", resetStart);
  assert.match(page.slice(resetStart, resetEnd), /publishActiveProgress\(0\)/);
});

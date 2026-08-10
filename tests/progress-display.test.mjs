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

test("publishes progress only for numbered recorded AI audio", async () => {
  const page = await readFile(pageUrl, "utf8");
  const playStart = page.indexOf("const playInstruction");
  const playEnd = page.indexOf("const markDecision", playStart);
  const playInstruction = page.slice(playStart, playEnd);
  const recordStart = playInstruction.indexOf("if (shouldRecord)");
  const recordedPlayback = playInstruction.slice(recordStart);

  assert.ok(recordStart > 0);
  assert.match(
    recordedPlayback,
    /const progressStep = progressStepForTask\(activePlan\.tasks\[taskNumber - 1\]\)/,
  );
  assert.match(recordedPlayback, /if \(progressStep !== null\)/);
  assert.match(recordedPlayback, /publishActiveProgress\(progressStep\)/);
  assert.doesNotMatch(recordedPlayback, /publishActiveProgress\(taskNumber\)/);
  assert.doesNotMatch(playInstruction.slice(0, recordStart), /publishActiveProgress/);
  assert.match(recordedPlayback, /updateTask\(planId, taskNumber/);
  assert.match(recordedPlayback, /addLog\(/);
  assert.ok(
    recordedPlayback.indexOf("publishActiveProgress(progressStep)") <
      recordedPlayback.indexOf("updateTask(planId, taskNumber"),
  );
  assert.match(page, /optionIndex,\s*false,/);
});

test("initializes and resets the active plan at step zero with a countable total", async () => {
  const page = await readFile(pageUrl, "utf8");
  const publisherStart = page.indexOf("const publishActiveProgress");
  const publisherEnd = page.indexOf("useEffect", publisherStart);
  const publisher = page.slice(publisherStart, publisherEnd);
  assert.match(publisher, /totalSteps:\s*countProgressSteps\(activePlan\.tasks\)/);
  assert.doesNotMatch(publisher, /totalSteps:\s*activePlan\.tasks\.length/);

  const hydrationStart = page.indexOf("if (!hydrated) return;", page.indexOf("const activeState"));
  const hydrationEnd = page.indexOf("}, [activePlanIndex, hydrated, participantId]);", hydrationStart);
  const initialization = page.slice(hydrationStart, hydrationEnd);
  assert.ok(hydrationStart > 0 && hydrationEnd > hydrationStart);
  assert.match(initialization, /currentStep:\s*0/);
  assert.match(initialization, /totalSteps:\s*countProgressSteps\(plan\.tasks\)/);
  assert.doesNotMatch(initialization, /totalSteps:\s*plan\.tasks\.length/);

  const resetStart = page.indexOf("const resetSession");
  const resetEnd = page.indexOf("const handleParticipantIdChange", resetStart);
  assert.match(page.slice(resetStart, resetEnd), /publishActiveProgress\(0\)/);
});

test("renders a participant selector with the large progress display", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/progress/progress.module.css", import.meta.url), "utf8");
  const renderedMarkup = progressPage.slice(progressPage.indexOf("<main"), progressPage.lastIndexOf("</main>") + 7);
  const valueStart = css.indexOf(".value");
  const valueEnd = css.indexOf("}", valueStart);
  const valueRule = css.slice(valueStart, valueEnd);

  assert.match(progressPage, /role="progressbar"/);
  assert.match(progressPage, /aria-valuetext=\{`\$\{progress\.currentStep\}\/\$\{progress\.totalSteps\}`\}/);
  assert.match(progressPage, /aria-valuemin=\{progress\.totalSteps > 0 \? 0 : undefined\}/);
  assert.match(progressPage, /aria-valuemax=\{progress\.totalSteps > 0 \? progress\.totalSteps : undefined\}/);
  assert.match(progressPage, /aria-valuenow=\{progress\.totalSteps > 0 \? progress\.currentStep : undefined\}/);
  assert.match(progressPage, /\{progress\.currentStep\}\/\{progress\.totalSteps\}/);
  assert.match(renderedMarkup, /<select/);
  assert.match(renderedMarkup, /value=\{participantId\}/);
  assert.match(renderedMarkup, /Array\.from\(\{ length: 36 \}/);
  assert.match(renderedMarkup, /formatParticipantLabel\(id\)/);
  assert.doesNotMatch(renderedMarkup, /<button|<a\b|plan title|connection|reconnecting/i);
  assert.match(valueRule, /font-size:\s*clamp\(120px,\s*min\(32vw,\s*34vh\),\s*420px\)/);
  assert.match(valueRule, /line-height:\s*0\.8/);
});

test("confirms a different participant before replacing the URL and polling target", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  const handlerStart = progressPage.indexOf("const handleParticipantChange");
  const handlerEnd = progressPage.indexOf("const percentage", handlerStart);
  const handler = progressPage.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart > 0 && handlerEnd > handlerStart);
  assert.match(handler, /if \(nextParticipantId === participantId\) return/);
  assert.match(handler, /window\.confirm/);
  assert.match(handler, /Switch progress display from \$\{formatParticipantLabel\(participantId\)\} to \$\{formatParticipantLabel\(nextParticipantId\)\}\?/);
  assert.match(handler, /if \(!confirmed\) return/);
  assert.match(handler, /setProgress\(emptyProgress\(nextParticipantId\)\)/);
  assert.match(handler, /window\.history\.replaceState/);
  assert.match(handler, /participantProgressUrl\(window\.location\.href, nextParticipantId\)/);
  assert.match(handler, /setParticipantId\(nextParticipantId\)/);
  assert.ok(handler.indexOf("if (!confirmed) return") < handler.indexOf("setProgress"));
  assert.ok(handler.indexOf("setProgress") < handler.indexOf("window.history.replaceState"));
  assert.ok(handler.indexOf("window.history.replaceState") < handler.indexOf("setParticipantId"));
});

test("positions the participant selector near the top-right corner", async () => {
  const css = await readFile(new URL("../app/progress/progress.module.css", import.meta.url), "utf8");
  const selectorStart = css.indexOf(".participantPicker");
  const selectorEnd = css.indexOf("}", selectorStart);
  const selectorRule = css.slice(selectorStart, selectorEnd);

  assert.ok(selectorStart >= 0);
  assert.match(selectorRule, /position:\s*fixed/);
  assert.match(selectorRule, /top:/);
  assert.match(selectorRule, /right:/);
});

test("polls the requested participant once per second and retains state on failure", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  assert.match(progressPage, /URLSearchParams\(window\.location\.search\)/);
  assert.match(progressPage, /normalizeParticipantId/);
  assert.match(progressPage, /fetchProgress\(participantId\)/);
  assert.match(progressPage, /window\.setInterval\([^,]+,\s*1000\)/s);
  assert.match(progressPage, /catch\s*\{[\s\S]*retain the last valid value/);
  assert.match(progressPage, /window\.clearInterval/);
});

test("clears progress after a successful empty response and otherwise applies a monotonic update", async () => {
  const progressPage = await readFile(new URL("../app/progress/page.tsx", import.meta.url), "utf8");
  assert.match(
    progressPage,
    /const emptyProgress = \(participantId: number\) => \(\{[\s\S]*\.\.\.EMPTY_PROGRESS,[\s\S]*participantId,[\s\S]*\}\);/,
  );
  assert.match(progressPage, /selectNewerProgress/);
  assert.match(
    progressPage,
    /setProgress\(\s*\(?current\)?\s*=>\s*next === null\s*\? emptyProgress\(participantId\)\s*:\s*selectNewerProgress\(current,\s*next\)\s*,?\s*\)/s,
  );
});

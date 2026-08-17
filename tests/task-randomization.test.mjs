import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function loadRandomizedStudyTasks() {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const withoutImports = source.replace(
    /^"use client";\n\nimport[\s\S]+?from "\.\/progress-sync\.mjs";\n\n/,
    "",
  );
  const prefixEnd = withoutImports.indexOf("\nconst plans: Plan[] = [");
  assert.notEqual(prefixEnd, -1);

  const executableSource = `${withoutImports.slice(0, prefixEnd)}
globalThis.__randomizedStudyTasks = randomizedStudyTasks;`;
  const { outputText } = ts.transpileModule(executableSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const context = { process: { env: {} } };
  vm.runInNewContext(outputText, context);
  return context.__randomizedStudyTasks;
}

function stageForSequenceNumber(sequenceNumber) {
  if (sequenceNumber >= 2 && sequenceNumber <= 4) return "early";
  if (sequenceNumber >= 5 && sequenceNumber <= 7) return "middle";
  if (sequenceNumber >= 8 && sequenceNumber <= 10) return "late";
  return "outside";
}

function summarizeMisleadingPositions(randomizedStudyTasks, planId) {
  const stageCounts = {
    early: { 2: 0, 3: 0, 4: 0 },
    middle: { 5: 0, 6: 0, 7: 0 },
    late: { 8: 0, 9: 0, 10: 0 },
  };

  for (let participantId = 1; participantId <= 36; participantId += 1) {
    const misleadingTasks = randomizedStudyTasks(planId, participantId).filter(
      (task) => task.mainKind === "incorrect",
    );
    assert.equal(misleadingTasks.length, 3);

    const stageHits = { early: 0, middle: 0, late: 0 };
    for (const task of misleadingTasks) {
      const stage = stageForSequenceNumber(task.sequenceNumber);
      assert.notEqual(stage, "outside");
      stageCounts[stage][task.sequenceNumber] += 1;
      stageHits[stage] += 1;
    }

    assert.deepEqual(stageHits, { early: 1, middle: 1, late: 1 });
  }

  return stageCounts;
}

test("counterbalances misleading positions across participants for shelf and boba", async () => {
  const randomizedStudyTasks = await loadRandomizedStudyTasks();

  for (const planId of ["shelf", "boba"]) {
    assert.deepEqual(summarizeMisleadingPositions(randomizedStudyTasks, planId), {
      early: { 2: 12, 3: 12, 4: 12 },
      middle: { 5: 12, 6: 12, 7: 12 },
      late: { 8: 12, 9: 12, 10: 12 },
    });
  }
});

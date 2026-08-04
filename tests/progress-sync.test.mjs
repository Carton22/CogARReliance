import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProgress,
  normalizeParticipantId,
  normalizeProgress,
  progressPercentage,
  publishProgress,
} from "../app/progress-sync.mjs";

const valid = {
  participantId: 7,
  planId: "shelf",
  currentStep: 5,
  totalSteps: 20,
  updatedAt: "2026-08-04T12:00:00.000Z",
};

test("normalizes participant IDs into the supported range", () => {
  assert.equal(normalizeParticipantId("7"), 7);
  assert.equal(normalizeParticipantId("0"), 1);
  assert.equal(normalizeParticipantId("37"), 1);
  assert.equal(normalizeParticipantId("words"), 1);
});

test("accepts valid progress and rejects malformed progress", () => {
  assert.deepEqual(normalizeProgress(valid), valid);
  assert.equal(normalizeProgress({ ...valid, currentStep: 21 }), null);
  assert.equal(normalizeProgress({ ...valid, planId: "unknown" }), null);
  assert.equal(normalizeProgress(null), null);
});

test("clamps percentage into the visual range", () => {
  assert.equal(progressPercentage(valid), 25);
  assert.equal(progressPercentage({ ...valid, currentStep: -4 }), 0);
  assert.equal(progressPercentage({ ...valid, currentStep: 99 }), 100);
  assert.equal(progressPercentage({ ...valid, totalSteps: 0 }), 0);
});

test("publishes a typed progress payload without requiring a readable CORS response", async () => {
  const calls = [];
  await publishProgress(valid, async (...args) => {
    calls.push(args);
    return new Response(null, { status: 200 });
  });

  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.match(String(url), /script\.google\.com/);
  assert.equal(options.method, "POST");
  assert.equal(options.mode, "no-cors");
  assert.deepEqual(JSON.parse(options.body), {
    type: "progress",
    progress: valid,
  });
});

test("fetches the latest progress for one participant", async () => {
  const result = await fetchProgress(7, async (url, options) => {
    assert.equal(new URL(String(url)).searchParams.get("participant"), "7");
    assert.equal(options.cache, "no-store");
    return Response.json({ ok: true, progress: valid });
  });
  assert.deepEqual(result, valid);
});

test("distinguishes an empty valid state from a failed response", async () => {
  assert.equal(
    await fetchProgress(7, async () => Response.json({ ok: true, progress: null })),
    null,
  );
  await assert.rejects(
    fetchProgress(7, async () => new Response("bad", { status: 500 })),
    /progress request failed/i,
  );
});

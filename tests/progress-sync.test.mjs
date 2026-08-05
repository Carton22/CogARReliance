import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProgress,
  formatParticipantLabel,
  normalizeParticipantId,
  normalizeProgress,
  participantProgressUrl,
  progressPercentage,
  publishProgress,
  selectNewerProgress,
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

test("formats normalized participant IDs as two-digit labels", () => {
  assert.equal(formatParticipantLabel(1), "Participant 01");
  assert.equal(formatParticipantLabel("7"), "Participant 07");
  assert.equal(formatParticipantLabel(36), "Participant 36");
  assert.equal(formatParticipantLabel("invalid"), "Participant 01");
});

test("replaces only the participant query value in a progress URL", () => {
  assert.equal(
    participantProgressUrl(
      "https://carton22.github.io/CogARReliance/progress?participant=1&display=large#bar",
      12,
    ),
    "/CogARReliance/progress?participant=12&display=large#bar",
  );
  assert.equal(
    participantProgressUrl("https://example.test/progress?display=large", 37),
    "/progress?display=large&participant=1",
  );
});

test("accepts valid progress and rejects malformed progress", () => {
  assert.deepEqual(normalizeProgress(valid), valid);
  assert.equal(normalizeProgress({ ...valid, currentStep: 21 }), null);
  assert.equal(normalizeProgress({ ...valid, planId: "unknown" }), null);
  assert.equal(normalizeProgress({ ...valid, updatedAt: "not-an-iso-timestamp" }), null);
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
  assert.equal(options.credentials, "include");
  assert.deepEqual(JSON.parse(options.body), {
    type: "progress",
    progress: valid,
  });
});

test("fetches the latest progress for one participant", async () => {
  const result = await fetchProgress(7, async (url, options) => {
    assert.equal(new URL(String(url)).searchParams.get("participant"), "7");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    return Response.json({ ok: true, progress: valid });
  });
  assert.deepEqual(result, valid);
});

test("rejects progress returned for a different participant", async () => {
  await assert.rejects(
    fetchProgress(7, async () =>
      Response.json({ ok: true, progress: { ...valid, participantId: 8 } }),
    ),
    /progress response was invalid/i,
  );
});

test("keeps the newest progress when responses resolve out of timestamp order", () => {
  const newer = {
    ...valid,
    currentStep: 9,
    updatedAt: "2026-08-04T12:00:02.000Z",
  };
  const delayedOlder = {
    ...valid,
    currentStep: 3,
    updatedAt: "2026-08-04T12:00:01.000Z",
  };

  let displayed = selectNewerProgress(null, newer);
  displayed = selectNewerProgress(displayed, delayedOlder);

  assert.deepEqual(displayed, newer);
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

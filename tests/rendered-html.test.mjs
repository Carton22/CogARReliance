import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the starter loading skeleton", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /<title>Your site is taking shape<\/title>/i);
  assert.match(html, /Building your site/);
  assert.match(html, /Your site is taking shape/);
  assert.match(
    html,
    /Your first version will appear here automatically when it’s ready\./,
  );
  assert.doesNotMatch(html, /Codex/);
  assert.match(html, /react-loading-skeleton/);
  assert.match(html, /role="status"/);
});

test("keeps the loading skeleton scoped and disposable", async () => {
  const [preview, css, page, layout, packageJson, files] = await Promise.all([
    readFile(new URL("SkeletonPreview.tsx", previewRoot), "utf8"),
    readFile(new URL("preview.css", previewRoot), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(previewRoot),
  ]);

  assert.deepEqual(files.sort(), ["SkeletonPreview.tsx", "preview.css"]);
  assert.match(preview, /from "react-loading-skeleton"/);
  assert.match(preview, /baseColor="#eceae7"/);
  assert.match(preview, /highlightColor="#f9f8f6"/);
  assert.match(preview, /duration=\{2\.8\}/);
  assert.match(preview, /sites-skeleton-search-placeholder/);
  assert.match(packageJson, /"react-loading-skeleton": "3\.5\.0"/);

  const shellIndex = preview.indexOf('className="sites-skeleton-shell"');
  const statusIndex = preview.indexOf('className="sites-skeleton-status"');
  assert.ok(shellIndex >= 0 && statusIndex > shellIndex);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /inset:\s*0/);
  assert.match(css, /opacity:\s*0\.52/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#020617|canvas|pets|progress/i);
  assert.doesNotMatch(
    preview,
    /loading-spinner|status-mark|status-progress|canvas|cookie|random/i,
  );

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /"codex-preview": "development"/);
  assert.match(page, /<SkeletonPreview \/>/);
  assert.match(layout, /title:\s*"Starter Project"/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
  assert.doesNotMatch(css, /(^|\s)(html|body)\s*\{/m);

  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});

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
  assert.match(page, /const distractor = distractors\[blockIndex\]/);
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
  assert.match(script, /function doGet\(\)/);
  assert.match(script, /appendRow/);
  assert.match(script, /participant_id/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);

test("GitHub Pages targets the Carton22/CogARReliance fork", async () => {
  const [nextConfig, workflow, packageJsonSource] = await Promise.all([
    readFile(new URL("next.config.ts", repositoryRoot), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", repositoryRoot), "utf8"),
    readFile(new URL("package.json", repositoryRoot), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);

  assert.match(nextConfig, /repositoryBasePath\s*=.*"\/CogARReliance"/);
  assert.match(workflow, /NEXT_PUBLIC_BASE_PATH:\s*\/CogARReliance/);
  assert.match(
    workflow,
    /NEXT_PUBLIC_SITE_ORIGIN:\s*https:\/\/carton22\.github\.io/,
  );
  assert.equal(packageJson.scripts["test:unit"], "node --test tests/*.test.mjs");
  assert.match(packageJson.scripts.test, /npm run test:unit/);
  assert.match(workflow, /run: npm run test:unit/);
  assert.match(workflow, /run: npm run lint/);
});

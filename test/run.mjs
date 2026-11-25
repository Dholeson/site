// npm test: runs every test/*.test.js, in alphabetical order, each in its own
// Node process from the repo root, so a new test file can't be left out of
// the suite by forgetting to list it somewhere.
//
// Each file runs as `node --disable-warning=ExperimentalWarning <file>` (the
// store tests use node:sqlite, which needs Node 22.5+ and warns that it is
// experimental) with its output passed straight through. Every file runs even
// after one fails; the exit code is the first failure's.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const files = readdirSync(join(ROOT, "test"))
  .filter(f => f.endsWith(".test.js"))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const failures = [];
for (const file of files) {
  const rel = `test/${file}`;
  console.log(`\n=== ${rel}`);
  const r = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", rel], {
    cwd: ROOT,
    stdio: "inherit"
  });
  const code = r.status ?? 1;
  if (r.error || code !== 0) {
    failures.push({ rel, code, why: r.error ? r.error.message : r.signal ? `killed by ${r.signal}` : `exit ${code}` });
  }
}

if (failures.length) {
  console.error(`\n${failures.length} of ${files.length} test files failed:`);
  for (const f of failures) console.error(`  ${f.rel} (${f.why})`);
  process.exit(failures[0].code || 1);
}
console.log(`\nAll ${files.length} test files passed.`);

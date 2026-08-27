#!/usr/bin/env node
// Re-vendor the Gen I parser from the `dex` repo into projects/gen1/.
//
// The site has no build step, so the browser demo cannot import TypeScript from
// a sibling checkout. Instead the parser is compiled once and committed here.
// That is a copy, and copies drift — so this script exists to make resyncing a
// single command rather than a thing you do by hand and get wrong.
//
//   node scripts/sync-gen1.mjs [path-to-dex-repo]
//
// Defaults to ../dex relative to this site checkout. After running it, run
// `npm test` — test/gen1-parser.test.js is what catches a bad resync.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dexRoot  = resolve(process.argv[2] ?? join(siteRoot, "..", "dex"));

const PARSER_SRC = join(dexRoot, "server", "src", "parser");
const SPECIES_SRC = join(dexRoot, "data", "raw", "species.json");
const PARSER_OUT = join(siteRoot, "projects", "gen1", "parser");
const DATA_OUT   = join(siteRoot, "projects", "gen1", "data");

// The parser is intentionally pure — no filesystem, no network, Buffer only ever
// indexed — which is the only reason the same code runs in a tab. If that ever
// stops being true, this sync is the wrong tool and the port needs rethinking.
const MODULES = [
  "bcd.ts", "bitfield.ts", "charmap.ts", "checksum.ts",
  "pokemon.ts", "speciesIndex.ts", "types.ts", "index.ts"
];

function fail(msg) {
  console.error(`sync-gen1: ${msg}`);
  process.exit(1);
}

if (!existsSync(PARSER_SRC)) {
  fail(`no parser at ${PARSER_SRC}\n  pass the dex repo path: node scripts/sync-gen1.mjs ../path/to/dex`);
}

const tsc = join(dexRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
if (!existsSync(tsc)) fail(`typescript not installed in ${dexRoot} — run npm install there first`);

rmSync(PARSER_OUT, { recursive: true, force: true });
mkdirSync(PARSER_OUT, { recursive: true });
mkdirSync(DATA_OUT, { recursive: true });

console.log(`sync-gen1: compiling ${MODULES.length} modules from ${PARSER_SRC}`);
execFileSync(tsc, [
  ...MODULES.map(m => join(PARSER_SRC, m)),
  "--outDir", PARSER_OUT,
  "--module", "es2020",
  "--target", "es2020",
  "--moduleResolution", "node",
  "--skipLibCheck",
  "--declaration", "false"
], { stdio: "inherit" });

copyFileSync(SPECIES_SRC, join(DATA_OUT, "species.json"));

console.log(`sync-gen1: wrote ${PARSER_OUT}`);
console.log(`sync-gen1: wrote ${join(DATA_OUT, "species.json")}`);
console.log(`sync-gen1: now run \`npm test\``);

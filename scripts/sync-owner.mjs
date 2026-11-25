// npm run sync:owner: after changing data/owner.js (fullName) or the profile
// in data/portfolio.js, this rewrites the portfolio's static head block, the
// part of portfolio.html between <!-- owner:start --> and <!-- owner:end -->,
// from scripts/lib/owner-markup.mjs. test/portfolio.test.js fails until it
// has been run.
//
// Then, when scripts/render-brand.mjs is present, it runs that with the same
// node binary, so og-portfolio.png (the portfolio's link-preview card) shows
// the same name. render-brand needs Playwright; see its header comment.
//
// Exit 0 when both steps worked (or the render was skipped), 1 otherwise.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OWNER } from "../data/owner.js";
import { profile } from "../data/portfolio.js";
import { portfolioOwnerBlock, withOwnerBlock } from "./lib/owner-markup.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = join(ROOT, "portfolio.html");

let html;
let next;
try {
  html = readFileSync(page, "utf8");
  next = withOwnerBlock(html, portfolioOwnerBlock(OWNER, profile));
} catch (err) {
  console.error(`sync-owner: ${err.message}`);
  process.exit(1);
}

if (next === html) {
  console.log("portfolio.html: the owner block is already up to date.");
} else {
  writeFileSync(page, next);
  console.log(`portfolio.html: owner block rewritten (h1: ${OWNER.fullName ? JSON.stringify(OWNER.fullName) : '"Product case studies"'}).`);
}

const brand = join(ROOT, "scripts", "render-brand.mjs");
if (!existsSync(brand)) {
  console.log("og-portfolio.png: skipped, because scripts/render-brand.mjs isn't here.");
  process.exit(0);
}

console.log("og-portfolio.png: re-rendering the link-preview images with scripts/render-brand.mjs ...");
const r = spawnSync(process.execPath, [brand], { cwd: ROOT, stdio: "inherit", env: process.env });
if (r.error || r.status !== 0) {
  const why = r.error ? r.error.message : r.signal ? `killed by ${r.signal}` : `exit ${r.status}`;
  console.error(`sync-owner: render-brand failed (${why}). portfolio.html is up to date, but og-portfolio.png may still show the old name.`);
  process.exit(1);
}

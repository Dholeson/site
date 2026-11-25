// Loads Playwright's Chromium for the dev scripts (check-layout, render-brand,
// capture-tools). Playwright is not a dependency of the site: install it
// yourself, or point PLAYWRIGHT_MODULE at an existing install, e.g.
//   PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.js npm run check:layout
//
//   import { loadChromium } from "./lib/playwright.mjs";
//   const chromium = await loadChromium();
//   const browser = await chromium.launch();

import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

export const INSTALL_HINT =
  "Install Playwright: npm i -D playwright && npx playwright install chromium, or set PLAYWRIGHT_MODULE";

export async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_MODULE || "playwright";
  try {
    const mod = await import(isAbsolute(spec) ? pathToFileURL(spec).href : spec);
    const chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (!chromium || typeof chromium.launch !== "function") throw new Error(`${spec} has no chromium export`);
    return chromium;
  } catch (err) {
    throw new Error(INSTALL_HINT, { cause: err });
  }
}

export default loadChromium;

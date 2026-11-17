// Vendors the Discover Cleaner web demo into projects/discover-cleaner-demo/.
//
// The demo is built in the app's own repo
// (https://github.com/Dholeson/spotify-discover-cleaner): `python
// dev/build_web_demo.py` writes dist/web-demo/. Everything under
// projects/discover-cleaner-demo/ is a copy of that build. Do not hand-edit it:
// change the app, rebuild it there, and run this again.
//
//   npm run sync:discover-cleaner              # from ../spotify-discover-cleaner/dist/web-demo
//   npm run sync:discover-cleaner -- <dir>     # from a build somewhere else
//
// The folder is replaced wholesale, so files a newer build dropped don't
// linger. Run `npm test` afterwards: test/discover-cleaner-demo.test.js checks
// the copy (no inline scripts, every referenced file present, fixtures parse,
// size budget). The demo is served under its own CSP -- see _headers.

import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "projects", "discover-cleaner-demo");
const src = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, "../spotify-discover-cleaner/dist/web-demo");

if (!existsSync(join(src, "index.html"))) {
  console.error(`No demo build found at ${src} (no index.html).`);
  console.error("Build it in the app repo first: python dev/build_web_demo.py");
  process.exit(1);
}
const fromDest = relative(dest, src);
if (fromDest === "" || (!fromDest.startsWith("..") && !isAbsolute(fromDest))) {
  console.error("The source must be the app's build, not the vendored copy.");
  process.exit(1);
}

// OS clutter never belongs in a deploy.
const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true, filter: p => !JUNK.has(basename(p)) });

let files = 0;
let bytes = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else { files++; bytes += st.size; }
  }
})(dest);

console.log(`Synced ${files} files (${(bytes / 1048576).toFixed(1)} MB) into ${relative(root, dest).split(sep).join("/")}/`);
console.log("Next: npm test");

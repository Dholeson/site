// Tests for photo sizes in link previews: lib/jpeg-size.js (a JPEG's pixel
// size from its header), the store_images table (migrations/1002) through
// lib/store-db.js, the bench API recording sizes on upload, and the product
// page's head declaring them (functions/product.js, lib/seo.js).
//
// iMessage only shows a large preview for an og:image at least 900 px wide.
// A photo known to be narrower gives way to the generic 1200x630 card; a
// photo of unknown size is previewed as it always was. None of this may
// change what the bench API answers RefurbOS (test/bench-api.test.js pins
// that, unchanged).
//
// The JPEGs here are hand-built headers: SOI, a few segments, a frame
// header, then EOI. That is all jpegSize reads.
//
// Run with:  npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { onRequest as bench } from "../functions/api/bench/[[path]].js";
import { onRequest as product } from "../functions/product.js";
import { jpegSize } from "../lib/jpeg-size.js";
import { getListing, imageSize, recordImageSize, toProduct } from "../lib/store-db.js";
import { FALLBACK_IMAGE, MIN_CARD_WIDTH, productHead } from "../lib/seo.js";
import { checkPatterns } from "./support/d1-sqlite.js";
import { harness } from "./support/harness.js";
import {
  MIGRATIONS, ROOT, TOKEN, makeEnv, call, jpeg, imageName, listingBody, pushListing
} from "./support/store-fixtures.js";

const { section, test, run } = harness();

// ---------- hand-built JPEGs ----------

const ascii = s => [...s].map(c => c.charCodeAt(0));
const be16 = v => [(v >> 8) & 0xff, v & 0xff];

// A marker segment: FF, the code, a two-byte length that counts itself, the payload.
const seg = (code, payload) => [0xff, code, ...be16(payload.length + 2), ...payload];
const app0 = () => seg(0xe0, [...ascii("JFIF"), 0, 1, 2, 0, 0, 1, 0, 1, 0, 0]);
const dqt = () => seg(0xdb, [0, ...new Array(64).fill(1)]);
// A table segment whose bytes, read as a frame header, would say 4660x22136.
const decoy = code => seg(code, [8, 0x56, 0x78, 0x12, 0x34, 1, 1, 0x11, 0]);
const frame = (code, width, height) => seg(code, [8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const sos = () => seg(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0]);
const EOI = [0xff, 0xd9];

const jpegOf = (...segments) => Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...sos(), 0x12, 0x34, ...EOI]);
const baseline = (width, height, ...before) => jpegOf(app0(), ...before, dqt(), frame(0xc0, width, height));

// An Exif APP1 segment with one IFD0 entry, Orientation, in either byte order.
function exif(orientation, { little = true } = {}) {
  const u16 = v => little ? [v & 0xff, (v >> 8) & 0xff] : be16(v);
  const u32 = v => little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]
                          : [(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const tiff = [
    ...(little ? ascii("II") : ascii("MM")), ...u16(42), ...u32(8),
    ...u16(1),                                          // one entry
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0,
    ...u32(0)                                           // no next IFD
  ];
  return seg(0xe1, [...ascii("Exif"), 0, 0, ...tiff]);
}
const xmp = () => seg(0xe1, [...ascii("http://ns.adobe.com/xap/1.0/"), 0, ...ascii("<x:xmpmeta/>")]);

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii("IHDR"), 0, 0, 4, 0xb0, 0, 0, 3, 0x84, 8, 2, 0, 0, 0]);

// ---------- lib/jpeg-size.js ----------

section("lib/jpeg-size.js");

test("a baseline JPEG (SOF0): its width and height", () => {
  assert.deepEqual(jpegSize(baseline(1200, 900)), { width: 1200, height: 900 });
  assert.deepEqual(jpegSize(baseline(1, 1)), { width: 1, height: 1 });
  assert.deepEqual(jpegSize(baseline(65535, 65535)), { width: 65535, height: 65535 });
});

test("a progressive JPEG (SOF2), and the other frame types", () => {
  assert.deepEqual(jpegSize(jpegOf(app0(), frame(0xc2, 1600, 1200))), { width: 1600, height: 1200 });
  for (const code of [0xc1, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
    assert.deepEqual(jpegSize(jpegOf(frame(code, 800, 600))), { width: 800, height: 600 }, code.toString(16));
  }
});

test("C4 (DHT), C8 (JPG) and CC (DAC) are skipped, not read as frame headers", () => {
  for (const code of [0xc4, 0xc8, 0xcc]) {
    const bytes = jpegOf(app0(), decoy(code), frame(0xc2, 1024, 768));
    assert.deepEqual(jpegSize(bytes), { width: 1024, height: 768 }, code.toString(16));
  }
});

test("an EXIF orientation of 5 to 8 swaps width and height; 1 to 4 don't", () => {
  for (const little of [true, false]) {
    for (const o of [5, 6, 7, 8]) {
      assert.deepEqual(jpegSize(baseline(4032, 3024, exif(o, { little }))), { width: 3024, height: 4032 }, `${o} ${little}`);
    }
    for (const o of [1, 2, 3, 4]) {
      assert.deepEqual(jpegSize(baseline(4032, 3024, exif(o, { little }))), { width: 4032, height: 3024 }, `${o} ${little}`);
    }
  }
  // An XMP APP1 first doesn't hide the Exif one; a value out of range is ignored.
  assert.deepEqual(jpegSize(baseline(4032, 3024, xmp(), exif(6))), { width: 3024, height: 4032 });
  assert.deepEqual(jpegSize(baseline(4032, 3024, exif(9))), { width: 4032, height: 3024 });
  // Exif after the frame header is never reached.
  assert.deepEqual(jpegSize(jpegOf(frame(0xc0, 4032, 3024), exif(6))), { width: 4032, height: 3024 });
});

test("fill bytes before a marker, and standalone markers, are stepped over", () => {
  const filled = Uint8Array.from([0xff, 0xd8, 0xff, 0xff, 0xff, ...app0().slice(1), 0xff, 0xd0, ...frame(0xc0, 640, 480), ...EOI]);
  assert.deepEqual(jpegSize(filled), { width: 640, height: 480 });
});

test("truncated input is null at every length short of the frame header's end", () => {
  const whole = baseline(1200, 900, exif(6));
  const frameEnd = whole.length - sos().length - 2 - EOI.length;
  assert.deepEqual(jpegSize(whole.subarray(0, frameEnd)), { width: 900, height: 1200 }, "exactly up to the frame header");
  for (let n = 0; n < frameEnd; n++) assert.equal(jpegSize(whole.subarray(0, n)), null, `${n} bytes`);
});

test("PNG, other non-JPEG input and malformed JPEGs are null, never a throw", () => {
  assert.equal(jpegSize(PNG), null);
  for (const v of [undefined, null, "", "ffd8ff", 42, {}, [0xff, 0xd8], new Uint8Array(0)]) {
    assert.equal(jpegSize(v), null, String(v));
  }
  const cases = {
    "a scan before any frame header": Uint8Array.from([0xff, 0xd8, ...app0(), ...sos(), ...EOI]),
    "EOI before a frame header": Uint8Array.from([0xff, 0xd8, ...app0(), ...EOI]),
    "height 0 (a DNL marker would say it)": jpegOf(frame(0xc0, 1200, 0)),
    "width 0": jpegOf(frame(0xc0, 0, 900)),
    "a frame header too short to hold a size": jpegOf(seg(0xc0, [8, 0, 1])),
    "a segment length under 2": Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, ...frame(0xc0, 10, 10)]),
    "a length running past the end": Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3]),
    "garbage between segments": Uint8Array.from([0xff, 0xd8, ...app0(), 0x00, ...frame(0xc0, 10, 10)]),
    "a second SOI": Uint8Array.from([0xff, 0xd8, 0xff, 0xd8, ...frame(0xc0, 10, 10)])
  };
  for (const [why, bytes] of Object.entries(cases)) assert.equal(jpegSize(bytes), null, why);
  // A broken Exif block costs only the rotation, not the size.
  const brokenExif = seg(0xe1, [...ascii("Exif"), 0, 0, ...ascii("II"), 42, 0, 0xff, 0xff, 0xff, 0x7f]);
  assert.deepEqual(jpegSize(baseline(300, 200, brokenExif)), { width: 300, height: 200 });
  // Random bytes after SOI: always null or a size, never a throw.
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
  for (let k = 0; k < 2000; k++) {
    const bytes = Uint8Array.from({ length: 4 + (k % 300) }, (_, i) => (i === 0 ? 0xff : i === 1 ? 0xd8 : rand()));
    const s = jpegSize(bytes);
    assert.ok(s === null || (s.width > 0 && s.height > 0));
  }
});

test("an ArrayBuffer or another view of the bytes reads the same", () => {
  const bytes = baseline(1200, 900);
  assert.deepEqual(jpegSize(bytes.buffer), { width: 1200, height: 900 });
  const padded = new Uint8Array(bytes.length + 8);
  padded.set(bytes, 8);
  assert.deepEqual(jpegSize(new DataView(padded.buffer, 8)), { width: 1200, height: 900 });
});

test("the store tests' stand-in photos have no readable size (so the seo tests see an unknown one)", () => {
  assert.equal(jpegSize(jpeg("a")), null);
  assert.equal(jpegSize(jpeg("max", 2_000_000)), null);
});

// ---------- migrations/1002 and lib/store-db.js ----------

section("store_images: migrations/1002_store_images.sql through lib/store-db.js");

const NAME = `${"b".repeat(64)}.jpg`;

test("the D1 stand-in applies 1002 after 1001, with no pattern D1 would refuse", () => {
  const env = makeEnv();
  assert.deepEqual(env.DB.applied.filter(n => /^100\d_/.test(n)), ["1001_store.sql", "1002_store_images.sql"]);
  const sql = readFileSync(join(MIGRATIONS, "1002_store_images.sql"), "utf8");
  checkPatterns(sql, "1002_store_images.sql");
  assert.ok(!/\b(LIKE|GLOB)\s+'/i.test(sql), "no LIKE or GLOB pattern at all");
  const cols = env.DB.raw.prepare("PRAGMA table_info(store_images)").all().map(c => [c.name, c.type, c.notnull, c.pk]);
  assert.deepEqual(cols, [["name", "TEXT", 0, 1], ["width", "INTEGER", 1, 0], ["height", "INTEGER", 1, 0]]);
  // Applying it twice is harmless.
  env.DB.raw.exec(sql);
});

test("recordImageSize upserts and imageSize reads it back; an unknown name is null", async () => {
  const { DB } = makeEnv();
  assert.equal(await imageSize(DB, NAME), null);
  await recordImageSize(DB, NAME, { width: 1200, height: 900 });
  assert.deepEqual(await imageSize(DB, NAME), { width: 1200, height: 900 });
  await recordImageSize(DB, NAME, { width: 1200, height: 900 });
  await recordImageSize(DB, NAME, { width: 900, height: 1200 });
  assert.deepEqual(await imageSize(DB, NAME), { width: 900, height: 1200 });
  assert.equal(DB.raw.prepare("SELECT count(*) AS n FROM store_images").get().n, 1);
  assert.equal(await imageSize(DB, `${"c".repeat(64)}.jpg`), null);
});

test("bad names and sizes are refused, by the code and by the table's CHECKs", async () => {
  const { DB } = makeEnv();
  for (const name of ["x.jpg", `${"B".repeat(64)}.jpg`, `${"b".repeat(64)}.png`, undefined]) {
    await assert.rejects(recordImageSize(DB, name, { width: 10, height: 10 }), TypeError, String(name));
  }
  for (const size of [null, {}, { width: 0, height: 10 }, { width: 10, height: -1 }, { width: 1.5, height: 10 }, { width: "10", height: 10 }, { width: 65536, height: 10 }]) {
    await assert.rejects(recordImageSize(DB, NAME, size), TypeError, JSON.stringify(size));
  }
  const insert = DB.raw.prepare("INSERT INTO store_images (name, width, height) VALUES (?, ?, ?)");
  assert.throws(() => insert.run("short.jpg", 10, 10), /CHECK/);
  assert.throws(() => insert.run(NAME, 0, 10), /CHECK/);
  assert.throws(() => insert.run(NAME, 10, 0), /CHECK/);
  assert.equal(DB.raw.prepare("SELECT count(*) AS n FROM store_images").get().n, 0);
});

// ---------- the bench API records sizes ----------

section("PUT /api/bench/images: the size is recorded, the answer is unchanged");

const putImage = (env, bytes, name = imageName(bytes)) =>
  call(bench, env, "PUT", `/api/bench/images/${name}`, { token: TOKEN, body: bytes, headers: { "Content-Type": "image/jpeg" } });
const sizeRow = (env, name) => env.DB.raw.prepare("SELECT width, height FROM store_images WHERE name = ?").get(name) ?? null;
const plain = r => r && { width: r.width, height: r.height };
const quietly = async fn => {
  const logged = [];
  const err = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try { return { result: await fn(), logged }; } finally { console.error = err; }
};

test("a new photo: 201 with exactly { name, url }, and its size recorded", async () => {
  const env = makeEnv();
  const bytes = baseline(1600, 1200, exif(6));
  const name = imageName(bytes);
  const r = await putImage(env, bytes);
  assert.equal(r.status, 201);
  assert.equal(r.text, JSON.stringify({ name, url: `/api/store/img/${name}` }));
  assert.deepEqual(plain(sizeRow(env, name)), { width: 1200, height: 1600 }, "EXIF 6: stored as shown");
});

test("a re-sent photo already in R2 (the early return): 200, unchanged, and its size recorded", async () => {
  const env = makeEnv();
  const bytes = baseline(1200, 900);
  const name = imageName(bytes);
  // In R2 from before sizes were recorded: no row.
  await env.STORE_IMAGES.put(`bench/${name}`, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  assert.equal(sizeRow(env, name), null);
  const r = await putImage(env, bytes);
  assert.equal(r.status, 200);
  assert.equal(r.text, JSON.stringify({ name, url: `/api/store/img/${name}` }));
  assert.deepEqual(plain(sizeRow(env, name)), { width: 1200, height: 900 });
  assert.equal(env.STORE_IMAGES.ops.filter(([op]) => op === "put").length, 1, "R2 isn't written again");
});

test("bytes with no readable size: the upload is the same and no row is written", async () => {
  const env = makeEnv();
  const bytes = jpeg("unreadable");
  const r = await putImage(env, bytes);
  assert.equal(r.status, 201);
  assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM store_images").get().n, 0);
});

test("refused uploads record nothing: a mismatched hash (400) or a body over the cap (413)", async () => {
  const env = makeEnv();
  const a = baseline(1200, 900), b = baseline(1300, 900);
  assert.equal((await putImage(env, b, imageName(a))).status, 400);
  const big = new Uint8Array(2_000_001);
  big.set(baseline(1200, 900));
  assert.equal((await putImage(env, big)).status, 413);
  assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM store_images").get().n, 0);
});

test("no D1 binding: the upload still works (R2 is all it needs)", async () => {
  const env = makeEnv({ DB: undefined });
  const bytes = baseline(1200, 900);
  const r = await putImage(env, bytes);
  assert.equal(r.status, 201);
  assert.ok(env.STORE_IMAGES.objects.has(`bench/${imageName(bytes)}`));
});

test("no store_images table (1002 not applied): new and re-sent uploads answer as before, and it only logs", async () => {
  const env = makeEnv();
  env.DB.raw.exec("DROP TABLE store_images");
  const bytes = baseline(1200, 900);
  const name = imageName(bytes);
  const { result: first, logged } = await quietly(() => putImage(env, bytes));
  assert.equal(first.status, 201);
  assert.equal(first.text, JSON.stringify({ name, url: `/api/store/img/${name}` }));
  assert.ok(env.STORE_IMAGES.objects.has(`bench/${name}`));
  assert.equal(logged.length, 1);
  assert.match(logged[0], /size/);
  const { result: again } = await quietly(() => putImage(env, bytes));
  assert.equal(again.status, 200);
  assert.equal(again.text, first.text);
});

// ---------- the product page's head ----------

section("the product head: declared sizes and the og-site.png fallback");

const PHOTO = `/api/store/img/${"a".repeat(64)}.jpg`;
const UNIT = {
  id: "ro-0042", name: "Nintendo 64, Charcoal", platform: "Nintendo 64", category: "console",
  condition: "Refurbished", priceCents: 15900, stock: 1, shippingClass: "console",
  image: PHOTO, images: [PHOTO], blurb: "Opened, cleaned and recapped.", details: [], source: "bench"
};
const OG_SITE = "https://dhole.dev/assets/brand/og-site.png";
const PHOTO_URL = `https://dhole.dev${PHOTO}`;
const metaContent = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:name|property)="${key.replace(/[.:]/g, "\\$&")}" content="([^"]*)"`));
  return m ? m[1] : null;
};
const card = h => ({
  image: metaContent(h, "og:image"),
  twitter: metaContent(h, "twitter:image"),
  width: metaContent(h, "og:image:width"),
  height: metaContent(h, "og:image:height"),
  alt: metaContent(h, "og:image:alt")
});
const ldImages = h => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).image;

test("a 600 px photo gives way to og-site.png at 1200x630", () => {
  assert.equal(MIN_CARD_WIDTH, 900);
  const h = productHead(UNIT, { photoSize: { width: 600, height: 450 } });
  assert.deepEqual(card(h), {
    image: OG_SITE, twitter: OG_SITE, width: String(FALLBACK_IMAGE.width), height: String(FALLBACK_IMAGE.height),
    alt: "dhole.dev: refurbished retro consoles and controllers"
  });
  assert.equal(FALLBACK_IMAGE.width, 1200);
  assert.equal(FALLBACK_IMAGE.height, 630);
  assert.deepEqual(ldImages(h), [PHOTO_URL], "the JSON-LD still lists the photo");
  // 899 still falls back; 900 is enough.
  assert.equal(card(productHead(UNIT, { photoSize: { width: 899, height: 2000 } })).image, OG_SITE);
  assert.equal(card(productHead(UNIT, { photoSize: { width: 900, height: 600 } })).image, PHOTO_URL);
});

test("a 1200 px photo goes out as the card, declared 1200x900", () => {
  const h = productHead(UNIT, { photoSize: { width: 1200, height: 900 } });
  assert.deepEqual(card(h), {
    image: PHOTO_URL, twitter: PHOTO_URL, width: "1200", height: "900", alt: "Photo 1 of RO-0042, Nintendo 64, Charcoal"
  });
  assert.equal(h.split('property="og:image:width"').length, 2, "declared once");
});

test("an unknown size behaves as before: the photo, no size declared", () => {
  const before = productHead(UNIT);
  for (const photoSize of [undefined, null, {}, { width: 0, height: 0 }, { width: "1200", height: "900" }, { width: 1200 }]) {
    assert.equal(productHead(UNIT, { photoSize }), before, JSON.stringify(photoSize));
  }
  assert.deepEqual(card(before), { image: PHOTO_URL, twitter: PHOTO_URL, width: null, height: null, alt: "Photo 1 of RO-0042, Nintendo 64, Charcoal" });
});

test("gone units keep the same image rule (a sold unit's card is still its photo or the card)", () => {
  assert.equal(card(productHead(UNIT, { state: "sold", photoSize: { width: 640, height: 480 } })).image, OG_SITE);
  assert.equal(card(productHead(UNIT, { state: "withdrawn", photoSize: { width: 1600, height: 1200 } })).width, "1600");
});

test("a size passed for an item with no raster photo changes nothing: it already uses the card", () => {
  const item = { ...UNIT, id: "plain-cable", source: undefined, image: "assets/store/av-cable.svg", images: undefined };
  assert.equal(productHead(item, { photoSize: { width: 1600, height: 1200 } }), productHead(item));
});

// Calls functions/product.js the way Pages does, with next() serving product.html.
const SHELL = readFileSync(join(ROOT, "product.html"), "utf8");
async function page(env, path) {
  const request = new Request(`https://dhole.dev${path}`);
  const next = async () => new Response(SHELL, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const res = await product({ request, env, params: {}, data: {}, waitUntil() {}, next });
  const html = await res.text();
  return { status: res.status, head: html.slice(0, html.indexOf("</head>")) };
}

// Uploads photos through the bench API, then lists the unit with them.
async function listWithPhotos(env, id, ...photos) {
  for (const p of photos) assert.ok([200, 201].includes((await putImage(env, p)).status));
  const r = await call(bench, env, "PUT", `/api/bench/listings/${id}`, { token: TOKEN, body: listingBody(id, photos.map(imageName)) });
  assert.equal(r.status, 200);
}

// Spies on the R2 stand-in's get(), keeping the options each call passed.
function spyGets(env) {
  const gets = [];
  const get = env.STORE_IMAGES.get.bind(env.STORE_IMAGES);
  env.STORE_IMAGES.get = async (key, options) => { gets.push([key, options]); return get(key, options); };
  return gets;
}

test("through the Function: a pushed 600 px photo 1 falls back to og-site.png with 1200x630", async () => {
  const env = makeEnv();
  const small = baseline(600, 450);
  await listWithPhotos(env, "ro-0060", small, baseline(1600, 1200));
  const gets = spyGets(env);
  const r = await page(env, "/product?id=ro-0060");
  assert.equal(r.status, 200);
  assert.deepEqual(card(r.head), {
    image: OG_SITE, twitter: OG_SITE, width: "1200", height: "630", alt: "dhole.dev: refurbished retro consoles and controllers"
  });
  assert.deepEqual(gets, [], "the size was recorded on upload: no R2 read");
});

test("through the Function: a pushed 1200 px photo 1 is the card, declared 1200x900", async () => {
  const env = makeEnv();
  const photo = baseline(1200, 900);
  await listWithPhotos(env, "ro-0061", photo);
  const r = await page(env, "/product?id=ro-0061");
  assert.equal(r.status, 200);
  assert.deepEqual(card(r.head), {
    image: `https://dhole.dev/api/store/img/${imageName(photo)}`, twitter: `https://dhole.dev/api/store/img/${imageName(photo)}`,
    width: "1200", height: "900", alt: `Photo 1 of RO-0061, ${listingBody("ro-0061", []).name}`
  });
});

test("a photo with no row is backfilled once, through a ranged R2 get of its first 128 KiB", async () => {
  const env = makeEnv();
  const photo = baseline(1600, 1200, exif(8));
  const name = imageName(photo);
  await listWithPhotos(env, "ro-0062", photo);
  env.DB.raw.prepare("DELETE FROM store_images").run();   // as if uploaded before 1002
  const gets = spyGets(env);

  let r = await page(env, "/product?id=ro-0062");
  assert.deepEqual([card(r.head).width, card(r.head).height], ["1200", "1600"]);
  assert.equal(card(r.head).image, `https://dhole.dev/api/store/img/${name}`);
  assert.deepEqual(gets, [[`bench/${name}`, { range: { offset: 0, length: 131072 } }]]);
  assert.deepEqual(plain(sizeRow(env, name)), { width: 1200, height: 1600 }, "recorded for next time");

  r = await page(env, "/product?id=ro-0062");
  assert.equal(card(r.head).width, "1200");
  assert.equal(gets.length, 1, "the second view reads the row, not R2");
});

test("the backfill reads past a 64 KiB EXIF block within the ranged get", async () => {
  const env = makeEnv();
  const bulky = seg(0xe1, [...ascii("Exif"), 0, 0, ...new Array(65000).fill(0)]);
  const icc = seg(0xe2, [...ascii("ICC_PROFILE"), 0, 1, 1, ...new Array(60000).fill(7)]);
  const photo = baseline(2000, 1500, bulky, icc);
  await listWithPhotos(env, "ro-0063", photo);
  env.DB.raw.prepare("DELETE FROM store_images").run();
  // Answer the way R2 does: only the requested range.
  const get = env.STORE_IMAGES.get.bind(env.STORE_IMAGES);
  env.STORE_IMAGES.get = async (key, options) => {
    const obj = await get(key);
    const { offset, length } = options.range;
    const part = new Uint8Array(await obj.arrayBuffer()).slice(offset, offset + length);
    return { ...obj, async arrayBuffer() { return part.buffer; } };
  };
  const r = await page(env, "/product?id=ro-0063");
  assert.equal(card(r.head).width, "2000");
});

test("a photo whose size can't be read: the head is as before, and nothing is recorded", async () => {
  const env = makeEnv();
  await pushListing(bench, env, "ro-0064");      // the stand-in photos, which have no frame header
  const r = await page(env, "/product?id=ro-0064");
  assert.equal(r.status, 200);
  assert.match(card(r.head).image, /^https:\/\/dhole\.dev\/api\/store\/img\/[0-9a-f]{64}\.jpg$/);
  assert.equal(card(r.head).width, null);
  assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM store_images").get().n, 0);
});

test("R2 failing during the backfill: the page still answers, as before", async () => {
  const env = makeEnv();
  const photo = baseline(1200, 900);
  await listWithPhotos(env, "ro-0065", photo);
  env.DB.raw.prepare("DELETE FROM store_images").run();
  env.STORE_IMAGES.get = async () => { throw new Error("R2 down"); };
  const { result: r, logged } = await quietly(() => page(env, "/product?id=ro-0065"));
  assert.equal(r.status, 200);
  assert.equal(card(r.head).image, `https://dhole.dev/api/store/img/${imageName(photo)}`);
  assert.equal(card(r.head).width, null);
  assert.equal(logged.length, 1);
});

test("no store_images table: uploads and product pages still succeed, with today's head", async () => {
  const env = makeEnv();
  env.DB.raw.exec("DROP TABLE store_images");
  const small = baseline(600, 450);
  const { logged } = await quietly(() => listWithPhotos(env, "ro-0066", small));
  assert.equal(logged.length, 1, "the upload logged once, and went through");
  const gets = spyGets(env);
  const { result: r } = await quietly(() => page(env, "/product?id=ro-0066"));
  assert.equal(r.status, 200);
  // Exactly the head a unit got before sizes existed: no photoSize at all.
  const before = productHead(toProduct(await getListing(env.DB, "ro-0066")), { state: "in-stock", checkout: true });
  assert.ok(r.head.includes(before), "the head productHead writes with no size");
  assert.equal(card(r.head).image, `https://dhole.dev/api/store/img/${imageName(small)}`, "the photo, not the fallback");
  assert.equal(card(r.head).width, null);
  assert.deepEqual(gets, [], "no backfill without a table to keep it in");
});

await run();

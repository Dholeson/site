// test fixtures; not linked from the site.
//
// Made-up bench units for scripts/check-layout.mjs and scripts/lib/static-server.mjs,
// shaped exactly like /api/store/listings entries (lib/store-db.js toProduct).
// None of this is a real unit, photo or reading: the photos are SVGs labelled
// "fixture photo N" (fixtureSvg), and the records follow the RefurbOS format in
// the redesign spec §15. The output dir is ".", so this file is served too;
// robots.txt disallows /scripts/ and nothing links here.
//
//   ro-9001  console, 8 photos, a 120-character name (LIMITS.name), the full
//            record with Looks lines at photos 5, 6 and 7
//   ro-9002  accessory (small class), 4 photos, Looks (photo 3), a Measured stick line
//   ro-9003  console, 1 photo, unprefixed details only
//   ro-9004  hostile name, blurb and details (<script>, quotes, &)
//   ro-9005  plain
//   ro-9006  a 120-character unbroken token in a Looks line and in the blurb
//   ro-9010  head only: reserved     ro-9011  head only: sold     ro-9012  head only: withdrawn
//   ro-9020+ plain filler, so a page can show N other units

import { createHash } from "node:crypto";

const LIMIT_NAME = 120;     // lib/store-db.js LIMITS.name
const LIMIT_DETAIL = 200;   // LIMITS.detail

// Deterministic 64-hex photo names: the same fixture always has the same URLs.
const hex = (id, n) => createHash("sha256").update(`dhole-fixture:${id}:${n}`).digest("hex");

const PHOTOS = new Map(); // "<hex>.jpg" -> { id, n, of }

function unit(id, fields, photoCount) {
  const names = Array.from({ length: photoCount }, (_, i) => `${hex(id, i + 1)}.jpg`);
  names.forEach((name, i) => PHOTOS.set(name, { id, n: i + 1, of: photoCount }));
  const images = names.map(name => `/api/store/img/${name}`);
  const p = {
    id,
    name: fields.name,
    platform: fields.platform,
    category: fields.category,
    condition: fields.condition,
    priceCents: fields.priceCents,
    stock: 1,
    shippingClass: fields.shippingClass,
    image: images[0],
    images,
    blurb: fields.blurb,
    details: fields.details || [],
    source: "bench"
  };
  if (p.name.length > LIMIT_NAME) throw new Error(`${id}: name over ${LIMIT_NAME} characters`);
  for (const d of p.details) if (d.length > LIMIT_DETAIL) throw new Error(`${id}: a detail line is over ${LIMIT_DETAIL} characters`);
  return p;
}

const PAD = "USB Gamepad (Vendor: 0079 Product: 0006)";
const TOKEN = "NUS-CPU-01-" + "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ".repeat(4).slice(0, 109);

const UNITS = [
  unit("ro-9001", {
    name: "Nintendo 64 console, Charcoal Grey, NTSC, with one original controller, a Jumper Pak, and the recapped power supply unit",
    platform: "Nintendo 64", category: "console", condition: "Refurbished", priceCents: 15900, shippingClass: "console",
    blurb: "Opened, cleaned and recapped, then played for an hour on three cartridges.\n\nThe photos are of this console.",
    details: [
      "Works: Boots and plays 3 cartridges for 60 minutes. All 4 controller ports read. Composite video and stereo audio checked.",
      "Replaced: Power supply filter capacitors (new, aftermarket).",
      `Measured: Stick rest offset 0.018, jitter 0.006 (2 s, 118 samples, ${PAD}, 2026-11-24)`,
      "Looks: Light yellowing on the lid (photo 5).",
      "Looks: Scuff on the right side, about 4 mm (photo 6).",
      "Looks: Small chip on the cartridge slot cover (photo 7).",
      "In the box: Console, 1 controller, Jumper Pak, power supply, composite AV cable.",
      "Not included: Expansion Pak, HDMI adapter, games.",
      "Output: Composite video only. Most modern TVs need an adapter."
    ]
  }, 8),
  unit("ro-9002", {
    name: "Nintendo 64 Controller, Grey",
    platform: "Nintendo 64", category: "accessory", condition: "Used, good", priceCents: 3200, shippingClass: "small",
    blurb: "Original controller. The stick returns to centre and every button registers.",
    details: [
      "Works: Every button, the Z trigger and the Controller Pak slot.",
      `Measured: Stick rest offset 0.021, jitter 0.004 (2 s, 120 samples, ${PAD}, 2026-11-24)`,
      "Looks: Light scuffs on the left grip (photo 3).",
      "In the box: Controller only."
    ]
  }, 4),
  unit("ro-9003", {
    name: "Super Nintendo console, SNS-001",
    platform: "Super Nintendo", category: "console", condition: "Used, good", priceCents: 11900, shippingClass: "console",
    blurb: "Cleaned inside and out and tested on four cartridges.",
    details: [
      "Region: NTSC (North America)",
      "Cartridge slot cleaned, every contact reads",
      "Comes with the power supply and a composite AV cable"
    ]
  }, 1),
  unit("ro-9004", {
    name: `<script>alert("name")</script> "Quoted" & 'single' <b>bold</b> Nintendo 64`,
    platform: "Nintendo 64 <i>x</i>", category: "console", condition: `Used, "fair" & <ok>`, priceCents: 8900, shippingClass: "console",
    blurb: `<img src=x onerror=alert(1)> She said "it works" & it's fine.</p><script>alert("blurb")</script>`,
    details: [
      `Works: <a href="javascript:alert(1)">boots</a> & "plays" 'fine'`,
      `Looks: <i>scratch</i> & "dent" on the lid (photo 1).`,
      `Looks: a mark near <script>alert(2)</script> (photo 9).`,
      `<b>unprefixed</b> & "line"`
    ]
  }, 2),
  unit("ro-9005", {
    name: "GameCube console, Indigo",
    platform: "GameCube", category: "console", condition: "Refurbished", priceCents: 12900, shippingClass: "console",
    blurb: "Laser cleaned and tested on six discs.",
    details: [
      "Works: Reads discs from a stack of 6 games. Both memory card slots read.",
      "In the box: Console, power supply, composite AV cable."
    ]
  }, 3),
  unit("ro-9006", {
    name: "Nintendo 64 console, Jungle Green",
    platform: "Nintendo 64", category: "console", condition: "Used, fair", priceCents: 9900, shippingClass: "console",
    blurb: `The label on the base reads ${TOKEN} and is left as it came.`,
    details: [
      "Works: Boots and plays 2 cartridges.",
      `Looks: Sticker residue reading ${TOKEN} on the base (photo 2).`
    ]
  }, 2),
  unit("ro-9010", {
    name: "PlayStation console, SCPH-7501",
    platform: "PlayStation", category: "console", condition: "Refurbished", priceCents: 7900, shippingClass: "console",
    blurb: "Laser cleaned and tested on five discs.",
    details: ["Works: Reads discs and both memory card slots."]
  }, 3),
  unit("ro-9011", {
    name: "Super Nintendo console, SNS-101",
    platform: "Super Nintendo", category: "console", condition: "Used, good", priceCents: 13900, shippingClass: "console",
    blurb: "Cleaned and tested on four cartridges.",
    details: ["Works: Plays 4 cartridges for 30 minutes."]
  }, 2),
  unit("ro-9012", {
    name: "Sega Dreamcast console, HKT-3020",
    platform: "Dreamcast", category: "console", condition: "Used, fair", priceCents: 14900, shippingClass: "console",
    blurb: "Tested on three discs.",
    details: ["Works: Reads 3 discs."]
  }, 2)
];

// Plain filler units, so --units N has N other units to show.
const FILLER = [
  ["GameCube Controller, Indigo", "GameCube", "accessory", "small", 3400],
  ["Sega Genesis console, Model 2", "Sega Genesis", "console", "console", 8900],
  ["Game Boy Pocket, Silver", "Game Boy", "console", "small", 6900],
  ["Nintendo 64 Controller, Black", "Nintendo 64", "accessory", "small", 2900],
  ["PlayStation 2 console, SCPH-77001", "PlayStation 2", "console", "console", 10900],
  ["GameCube Memory Card 251", "GameCube", "accessory", "small", 1900],
  ["Super Nintendo Controller", "Super Nintendo", "accessory", "small", 2400],
  ["Nintendo 64 console, Charcoal", "Nintendo 64", "console", "console", 13900]
].map(([name, platform, category, shippingClass, priceCents], i) => unit(`ro-${9020 + i}`, {
  name, platform, category, shippingClass, priceCents, condition: "Used, good",
  blurb: "Cleaned and tested.", details: ["Works: Tested before listing."]
}, 2));

export const FIXTURE_UNITS = [...UNITS, ...FILLER];

// The state lib/seo.js productHead() is given for each fixture's page.
export const FIXTURE_STATE = Object.fromEntries(FIXTURE_UNITS.map(p => [p.id, "in-stock"]));
FIXTURE_STATE["ro-9010"] = "reserved";
FIXTURE_STATE["ro-9011"] = "sold";
FIXTURE_STATE["ro-9012"] = "withdrawn";

// The units /api/store/listings would return, in the order "others" are
// added: the stress cases first, then the filler.
export const LIVE_POOL = ["ro-9001", "ro-9006", "ro-9004", "ro-9002", "ro-9003", "ro-9005",
  ...FILLER.map(p => p.id)];

// What /cart is seeded with (scripts/check-layout.mjs).
export const CART_SEED = ["ro-9001", "ro-9002", "ro-9005"];

export function fixtureById(id) {
  const product = FIXTURE_UNITS.find(p => p.id === id);
  return product ? { product, state: FIXTURE_STATE[id] } : null;
}

export const isLive = id => FIXTURE_STATE[id] === "in-stock";

// A listings response body's entries: the page's own live units first, then
// `count` others from the pool.
export function listingsFor({ own = [], count = 0 } = {}) {
  const mine = own.filter(isLive);
  const others = LIVE_POOL.filter(id => !mine.includes(id)).slice(0, Math.max(0, count));
  if (count > others.length) throw new Error(`Only ${LIVE_POOL.length} fixture units exist.`);
  return [...mine, ...others].map(id => fixtureById(id).product);
}

// "<hex>.jpg" -> { id, n, of }, or null.
export const photoFor = name => PHOTOS.get(name) || null;

// A 4:3 SVG standing in for a photo, labelled "fixture photo N".
export function fixtureSvg(name) {
  const p = photoFor(name);
  const label = p ? `fixture photo ${p.n}` : "fixture photo";
  const sub = p ? `${p.id.toUpperCase()}, ${p.n} of ${p.of}` : "unknown name";
  const ground = p && p.n % 2 === 0 ? "#dcdcdc" : "#e8e8e8";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">` +
    `<rect width="1200" height="900" fill="${ground}"/>` +
    `<rect x="40" y="40" width="1120" height="820" fill="none" stroke="#9a9a9a" stroke-width="4"/>` +
    `<text x="600" y="440" font-family="sans-serif" font-size="88" text-anchor="middle" fill="#333333">${label}</text>` +
    `<text x="600" y="540" font-family="sans-serif" font-size="48" text-anchor="middle" fill="#555555">${sub}</text>` +
    `</svg>`;
}

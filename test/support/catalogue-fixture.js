// Stand-in items for the tests that exercise the hand-typed catalogue
// (data/products.js) code paths: pricing, stock limits, shipping classes,
// product heads, the sitemap. The live catalogue is empty: every used console,
// controller and memory card is a bench unit from RefurbOS. These are the
// placeholder entries the site shipped with before that, kept here so the
// tests keep their exact numbers. They are never served.
//
// A test file that needs them pushes them into the imported array:
//   import { products } from "../data/products.js";
//   import { FIXTURE_PRODUCTS } from "./support/catalogue-fixture.js";
//   products.push(...FIXTURE_PRODUCTS);

export const FIXTURE_PRODUCTS = [
  {
    id: "n64-console-charcoal",
    name: "Nintendo 64 Console — Charcoal",
    platform: "Nintendo 64",
    category: "console",
    condition: "refurbished",
    priceCents: 14500,
    stock: 3,
    shippingClass: "console",
    image: "assets/store/n64-console.svg",
    blurb: "Cleaned, recapped where needed, and tested through a full boot cycle. Ships with a controller, power supply, and composite cable.",
    details: [
      "Region: NTSC (North America)",
      "Includes: console, 1 OEM controller, PSU, composite AV cable",
      "Controller sticks tested for drift and tightness",
      "30-day return window if it does not power on"
    ]
  },
  {
    id: "n64-controller-grey",
    name: "Nintendo 64 Controller — Grey",
    platform: "Nintendo 64",
    category: "accessory",
    condition: "used-good",
    priceCents: 3200,
    stock: 11,
    shippingClass: "small",
    image: "assets/store/n64-controller.svg",
    blurb: "Original Nintendo-branded controller. Stick tested for drift; no third-party replacements in this listing.",
    details: [
      "OEM Nintendo, not a reproduction",
      "Analogue stick tested — minimal wear",
      "Cable and connector intact",
      "Light cosmetic scuffing consistent with age"
    ]
  },
  {
    id: "gamecube-console-indigo",
    name: "GameCube Console — Indigo",
    platform: "GameCube",
    category: "console",
    condition: "refurbished",
    priceCents: 16500,
    stock: 2,
    shippingClass: "console",
    image: "assets/store/gamecube-console.svg",
    blurb: "Laser tested against a stack of discs, shell cleaned inside and out. Ships with controller, PSU, and composite cable.",
    details: [
      "Region: NTSC (North America)",
      "Includes: console, 1 OEM controller, PSU, composite AV cable",
      "Disc drive read-tested across multiple titles",
      "30-day return window if it does not power on"
    ]
  },
  {
    id: "gamecube-memory-card-251",
    name: "GameCube Memory Card 251",
    platform: "GameCube",
    category: "accessory",
    condition: "used-good",
    priceCents: 2400,
    stock: 8,
    shippingClass: "small",
    image: "assets/store/memory-card.svg",
    blurb: "251-block official memory card, formatted clean and verified to hold a save through a power cycle.",
    details: [
      "251 blocks (the larger official card)",
      "Formatted and save-tested",
      "Official Nintendo card",
      "Sold individually"
    ]
  },
  {
    id: "snes-console",
    name: "Super Nintendo Console",
    platform: "SNES",
    category: "console",
    condition: "refurbished",
    priceCents: 13500,
    stock: 4,
    shippingClass: "console",
    image: "assets/store/snes-console.svg",
    blurb: "Retrobrighted where the shell had yellowed, cartridge slot cleaned, and tested through a full boot. Controller and cables included.",
    details: [
      "Region: NTSC (North America)",
      "Includes: console, 1 OEM controller, PSU, composite AV cable",
      "Cartridge contacts cleaned",
      "30-day return window if it does not power on"
    ]
  },
  {
    id: "snes-controller",
    name: "Super Nintendo Controller",
    platform: "SNES",
    category: "accessory",
    condition: "used-good",
    priceCents: 2800,
    stock: 14,
    shippingClass: "small",
    image: "assets/store/snes-controller.svg",
    blurb: "Official SNES pad with every button tested. Membranes still crisp.",
    details: [
      "OEM Nintendo, not a reproduction",
      "All buttons and shoulder triggers tested",
      "Cable and connector intact",
      "Light cosmetic wear"
    ]
  },
  {
    id: "av-cable-composite",
    name: "Composite AV Cable (Multi-Out)",
    platform: "Multi-platform",
    category: "accessory",
    condition: "new",
    priceCents: 1200,
    stock: 25,
    shippingClass: "small",
    image: "assets/store/av-cable.svg",
    blurb: "New third-party multi-out composite cable. Fits N64, SNES, and GameCube.",
    details: [
      "Compatible with N64, SNES, and GameCube",
      "1.8m length",
      "New, third-party manufacture",
      "Shielded to cut buzz on long runs"
    ]
  },
  {
    id: "console-cleaning-kit",
    name: "Cartridge & Console Cleaning Kit",
    platform: "Multi-platform",
    category: "accessory",
    condition: "new",
    priceCents: 1800,
    stock: 30,
    shippingClass: "small",
    image: "assets/store/cleaning-kit.svg",
    blurb: "What I actually use on every console before it goes out: swabs, isopropyl, a security bit, and a slot cleaner.",
    details: [
      "3.8mm security bit (opens most cartridges and shells)",
      "Lint-free swabs and microfibre cloth",
      "Isopropyl wipes",
      "Cartridge slot cleaning tool"
    ]
  }
];

// Single source of truth for the store catalogue.
//
// IMPORTANT: this file is imported by BOTH the browser storefront and the
// Cloudflare Worker that creates Stripe Checkout sessions. The Worker is the
// side that decides what a customer actually pays, so prices here are the real
// prices. Never let the browser send a price to checkout -- it only ever sends
// an id and a quantity.
//
// Money is always an integer number of cents. No floats, ever: 0.1 + 0.2 in
// JavaScript is not 0.3, and that turns into mischarged customers.
//
// To add a product: copy a block, give it a new unique `id`, and commit.

export const CURRENCY = "usd";

// Flat-rate shipping per class, in cents. The heaviest class in an order wins
// (see pickShipping below) rather than summing, so a console plus three
// controllers ships as one console-sized box.
export const SHIPPING = {
  small:   { label: "Standard (accessories)", cents: 600 },
  console: { label: "Standard (console box)", cents: 1800 }
};

export const products = [
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

// ---- helpers shared by the browser and the Worker ----

export function findProduct(id) {
  return products.find(p => p.id === id) || null;
}

export function formatMoney(cents, currency = CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}

// Heaviest shipping class in the order decides the rate, rather than charging
// per item. One box, one rate.
export function pickShipping(lines) {
  const hasConsole = lines.some(l => {
    const p = findProduct(l.id);
    return p && p.shippingClass === "console";
  });
  return hasConsole ? SHIPPING.console : SHIPPING.small;
}

export const CONDITION_LABELS = {
  "new": "New",
  "refurbished": "Refurbished",
  "used-good": "Used — Good",
  "used-fair": "Used — Fair"
};

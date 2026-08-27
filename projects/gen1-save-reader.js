// Gen I Save Reader — browser front-end.
//
// The parser under ./gen1/parser/ is compiled straight out of the `dex` repo
// and is completely pure: bytes in, object out, no filesystem and no network.
// That is the whole reason this works as a static page — the .sav never leaves
// the browser, so there is nothing to upload and nothing to trust me with.
//
// Everything below is presentation. If a number looks wrong, the bug is almost
// certainly here and not in the parser, which has its own test suite.

import { parseSave } from "./gen1/parser/index.js";

const $ = id => document.getElementById(id);

// Completion denominators. Gen I has three honest answers to "what is 100%?"
// and picking one silently is how these tools end up lying to people:
//
//   cart    — what a single cartridge can reach with no outside help
//   trade   — everything obtainable by trading with another cart
//   full    — all 151, which needs an event Mew nobody legitimately has
//
// We show all three rather than arguing for one.
const DENOM_LABELS = {
  cart:  "on this cart alone",
  trade: "with trades",
  full:  "all 151"
};

let SPECIES = null;   // [{id,name,versionExclusive,requiresTrade,eventOnly}]
let SAVE = null;      // last parsed SaveState
let versionOverride = null;  // 'red' | 'blue' | null (null = use inference)

// ── Data ───────────────────────────────────────────────────────────────────

async function loadSpecies() {
  const res = await fetch("./gen1/data/species.json");
  if (!res.ok) throw new Error(`species.json: HTTP ${res.status}`);
  return res.json();
}

// ── Version inference ──────────────────────────────────────────────────────
//
// The save format cannot distinguish Red from Blue — the version byte does not
// exist. But the dex bitfield can: if a trainer owns Ekans and Oddish and no
// Sandshrew or Meowth, they are almost certainly on Red. We infer, show our
// work, and let the user overrule us.

function inferRedOrBlue(owned) {
  let red = 0, blue = 0;
  for (const s of SPECIES) {
    if (!owned[s.id - 1]) continue;
    if (s.versionExclusive === "red")  red++;
    if (s.versionExclusive === "blue") blue++;
  }
  if (red === 0 && blue === 0) return { version: null, red, blue, reason: "no version-exclusive species owned yet" };
  if (red === blue)            return { version: null, red, blue, reason: "owns both sides evenly — probably traded" };
  return {
    version: red > blue ? "red" : "blue",
    red, blue,
    reason: `owns ${Math.max(red, blue)} ${red > blue ? "Red" : "Blue"}-exclusive to ${Math.min(red, blue)} ${red > blue ? "Blue" : "Red"}-exclusive`
  };
}

function activeVersion() {
  if (versionOverride) return versionOverride;
  return SAVE ? inferRedOrBlue(SAVE.pokedex.owned).version : null;
}

// ── Completion maths ───────────────────────────────────────────────────────

// A species is reachable on a lone cartridge if it is not Mew, not the other
// version's exclusive, and not a trade evolution.
function reachableOnCart(s, version) {
  if (s.eventOnly) return false;
  if (s.requiresTrade) return false;
  if (s.versionExclusive && version && s.versionExclusive !== version) return false;
  return true;
}

function reachableByTrade(s) {
  return !s.eventOnly;
}

function completion(owned, version) {
  const cartSet  = SPECIES.filter(s => reachableOnCart(s, version));
  const tradeSet = SPECIES.filter(reachableByTrade);

  const ownedIn = set => set.filter(s => owned[s.id - 1]).length;

  return {
    cart:  { have: ownedIn(cartSet),  total: cartSet.length },
    trade: { have: ownedIn(tradeSet), total: tradeSet.length },
    full:  { have: owned.filter(Boolean).length, total: SPECIES.length }
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

const BADGE_NAMES = [
  ["boulder", "Boulder"], ["cascade", "Cascade"], ["thunder", "Thunder"], ["rainbow", "Rainbow"],
  ["soul", "Soul"], ["marsh", "Marsh"], ["volcano", "Volcano"], ["earth", "Earth"]
];

function fmtPlaytime(pt) {
  const h = pt.hours === 255 ? "255+" : String(pt.hours);
  return `${h}h ${String(pt.minutes).padStart(2, "0")}m`;
}

function renderTrainer(save) {
  const v = activeVersion();
  const versionLabel = save.version === "yellow"
    ? "Yellow"
    : v ? v[0].toUpperCase() + v.slice(1) : "Red or Blue";

  $("trainer").innerHTML = `
    <div class="readout dex-trainer">
      <div><span class="k">Trainer</span><div class="v">${esc(save.playerName) || "—"}</div></div>
      <div><span class="k">Rival</span><div class="v">${esc(save.rivalName) || "—"}</div></div>
      <div><span class="k">Version</span><div class="v">${versionLabel}</div></div>
      <div><span class="k">Money</span><div class="v">₽${save.money.toLocaleString()}</div></div>
      <div><span class="k">Playtime</span><div class="v">${fmtPlaytime(save.playtime)}</div></div>
      <div><span class="k">Badges</span><div class="v">${save.badges.count} / 8</div></div>
    </div>
    <div class="dex-badges">
      ${BADGE_NAMES.map(([key, label]) =>
        `<span class="dex-badge ${save.badges[key] ? "on" : ""}">${label}</span>`).join("")}
    </div>`;
}

function renderChecksum(save) {
  const el = $("checksum");
  if (save.checksum.valid) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.className = "notice error";
  el.innerHTML = `<strong>Checksum does not match.</strong>
    ${esc(save.error || "")}. Everything below was still parsed so you can look at it,
    but this save is either corrupt, mid-write, or edited. A real cartridge dump
    that fails here usually means a dying save battery.`;
}

function renderProgress(save) {
  const version = activeVersion();
  const c = completion(save.pokedex.owned, version);

  const bar = (key) => {
    const { have, total } = c[key];
    const pct = total ? (have / total) * 100 : 0;
    return `
      <div class="dex-bar-row">
        <div class="dex-bar-head">
          <span class="k">${DENOM_LABELS[key]}</span>
          <span class="mono dex-bar-num">${have} / ${total} · ${pct.toFixed(1)}%</span>
        </div>
        <div class="dex-bar"><span style="width:${pct.toFixed(2)}%"></span></div>
      </div>`;
  };

  const inf = inferRedOrBlue(save.pokedex.owned);
  const note = save.version === "yellow"
    ? `<p class="demo-note">Yellow save detected. The exclusivity table this page ships
       covers Red/Blue only, so the "on this cart alone" figure is not meaningful here —
       read the "with trades" row instead.</p>`
    : versionOverride
      ? `<p class="demo-note">Using <b>${versionOverride === "red" ? "Red" : "Blue"}</b> because you picked it.</p>`
      : inf.version
        ? `<p class="demo-note">Guessed <b>${inf.version === "red" ? "Red" : "Blue"}</b> — ${esc(inf.reason)}.
           The save format has no version byte, so this is inferred from the dex itself. Override it above if it is wrong.</p>`
        : `<p class="demo-note">Cannot tell Red from Blue yet — ${esc(inf.reason)}. Pick one above to get the
           single-cart figure.</p>`;

  $("progress").innerHTML = `
    <div class="readout dex-counts">
      <div><span class="k">Owned</span><div class="v">${save.pokedex.ownedCount}</div></div>
      <div><span class="k">Seen</span><div class="v">${save.pokedex.seenCount}</div></div>
      <div><span class="k">Party</span><div class="v">${save.party.length}</div></div>
      <div><span class="k">In boxes</span><div class="v">${save.boxes.reduce((n, b) => n + b.count, 0)}</div></div>
    </div>
    ${bar("cart")}${bar("trade")}${bar("full")}
    ${note}`;
}

function renderGrid(save) {
  const version = activeVersion();
  const { owned, seen } = save.pokedex;

  $("dex-grid").innerHTML = SPECIES.map(s => {
    const has = owned[s.id - 1];
    const saw = seen[s.id - 1];
    const state = has ? "owned" : saw ? "seen" : "missing";

    // Why it is out of reach, if it is. Only shown for things you do not have.
    let mark = "";
    if (!has) {
      if (s.eventOnly) mark = "event";
      else if (s.versionExclusive && version && s.versionExclusive !== version) mark = "other-version";
      else if (s.requiresTrade) mark = "trade";
    }

    const title = [
      `#${String(s.id).padStart(3, "0")} ${s.name}`,
      state === "owned" ? "caught" : state === "seen" ? "seen, not caught" : "not seen",
      s.eventOnly ? "event only" : "",
      s.requiresTrade ? "trade evolution" : "",
      s.versionExclusive ? `${s.versionExclusive}-exclusive` : ""
    ].filter(Boolean).join(" · ");

    return `<span class="dex-cell ${state}${mark ? " mark-" + mark : ""}" title="${esc(title)}">
      <b class="mono">${String(s.id).padStart(3, "0")}</b>${esc(s.name)}</span>`;
  }).join("");
}

function renderMissing(save) {
  const version = activeVersion();
  const owned = save.pokedex.owned;
  const missing = SPECIES.filter(s => !owned[s.id - 1]);

  const buckets = [
    {
      title: "Catchable now",
      hint: "In your version, no trading needed.",
      items: missing.filter(s => reachableOnCart(s, version))
    },
    {
      title: "Needs a trade partner",
      hint: "Trade evolutions — they will not evolve any other way.",
      items: missing.filter(s => s.requiresTrade)
    },
    {
      title: "Other version's exclusives",
      hint: "Only obtainable by trading with the other cartridge.",
      items: missing.filter(s => s.versionExclusive && version && s.versionExclusive !== version)
    },
    {
      title: "Not legitimately obtainable",
      hint: "Mew was never distributed on a US cart. Excluded from every count above except \"all 151\".",
      items: missing.filter(s => s.eventOnly)
    }
  ].filter(b => b.items.length);

  $("missing").innerHTML = buckets.length
    ? buckets.map(b => `
        <div class="dex-bucket">
          <h3>${b.title} <span class="mono dim">${b.items.length}</span></h3>
          <p class="demo-note">${b.hint}</p>
          <div class="dex-chips">${b.items.map(s =>
            `<span class="chip">#${String(s.id).padStart(3, "0")} ${esc(s.name)}</span>`).join("")}</div>
        </div>`).join("")
    : `<div class="notice"><strong>Nothing left.</strong> Every species this save can reach is caught.</div>`;
}

function renderParty(save) {
  if (!save.party.length) {
    $("party").innerHTML = `<p class="muted">No Pokémon in the party.</p>`;
    return;
  }
  $("party").innerHTML = `
    <div class="dex-party">
      ${save.party.map(p => {
        const species = SPECIES.find(s => s.id === p.dexNumber);
        return `<div class="dex-party-card">
          <div class="dex-party-nick">${esc(p.nickname) || "—"}</div>
          <div class="muted">${species ? esc(species.name) : `unknown (index ${p.speciesIndex})`}</div>
          <div class="mono dim">Lv ${p.level} · ${p.currentHp}/${p.maxHp} HP · OT ${esc(p.otName) || "—"}</div>
        </div>`;
      }).join("")}
    </div>`;
}

function renderAll() {
  if (!SAVE) return;
  renderChecksum(SAVE);
  renderTrainer(SAVE);
  renderProgress(SAVE);
  renderGrid(SAVE);
  renderMissing(SAVE);
  renderParty(SAVE);
  $("results").hidden = false;
  $("version-picker").hidden = SAVE.version === "yellow";
}

// ── File handling ──────────────────────────────────────────────────────────

function showError(msg) {
  const el = $("load-error");
  el.hidden = false;
  el.innerHTML = `<strong>Could not read that file.</strong> ${esc(msg)}`;
  $("results").hidden = true;
}

async function handleFile(file) {
  $("load-error").hidden = true;

  const buf = new Uint8Array(await file.arrayBuffer());

  // parseSave reports the size problem itself, but the message is friendlier
  // here where we know the filename and what people usually did wrong.
  if (buf.length !== 0x8000) {
    showError(`${esc(file.name)} is ${buf.length.toLocaleString()} bytes.
      A Gen I save is exactly 32,768. A 64 KB or 128 KB file is usually a whole
      cartridge ROM dump rather than the save, and .srm files from some emulators
      carry extra padding.`);
    return;
  }

  SAVE = parseSave(buf);
  versionOverride = null;
  document.querySelectorAll("[data-version]").forEach(b => b.classList.remove("active"));
  $("file-name").textContent = file.name;
  renderAll();
}

function wireDropzone() {
  const zone = $("dropzone");
  const input = $("file-input");

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });
  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  ["dragenter", "dragover"].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("over"); }));

  zone.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

function wireVersionPicker() {
  document.querySelectorAll("[data-version]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.version;
      versionOverride = versionOverride === v ? null : v;
      document.querySelectorAll("[data-version]").forEach(b =>
        b.classList.toggle("active", b.dataset.version === versionOverride));
      renderAll();
    });
  });
}

// Minimal escaping. Trainer names come from a Gen I charmap so they are already
// a restricted set, but nicknames get rendered too and this page should not care
// where the bytes came from.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function initSaveReader() {
  try {
    SPECIES = await loadSpecies();
  } catch (err) {
    showError(`Species data failed to load (${esc(err.message)}). The page cannot run without it.`);
    return;
  }
  wireDropzone();
  wireVersionPicker();
}

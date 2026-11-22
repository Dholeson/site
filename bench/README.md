# Bench Ops

A small appliance for the refurb bench: it notices a console joining the bench
LAN, walks the tech through a per-family QC checklist, records everything per
unit, and produces a store listing in the exact `data/products.js` shape.

It is an **inventory, QC and provenance system**. It is not, and won't become, a
mod or exploit delivery system.

One Python service plus one SQLite file. Runs on a Raspberry Pi 4/5 or a mini PC.
Offline once installed.

## The line this doesn't cross

Mods are done **by hand, on the console, by a tech following the shop's SOP**,
off this box. The appliance records that a mod happened (what, SOP reference,
who, when, on what firmware) and nothing else. That's enforced, not just
promised:

| Guard | Where |
|---|---|
| No JavaScript anywhere. Every response sends `script-src 'none'`; a test fails if a template gains a `<script>`, an `on…=` handler or a `javascript:` URL. | `web.py`, `tests/test_web.py` |
| A console's browser gets the intake page and its stylesheet, and a 403 for everything else (including `/media` and every POST). | `ConsoleGuard` in `web.py` |
| Uploads are allowlisted by their leading bytes: JPEG/PNG/WebP photos, MP4/MOV/WebM clips, plain-text logs. Executables, archives, console packages, disc images and HTML get refused, whatever they're named. | `media.py`, `tests/test_media.py` |
| Listing copy is linted: "preloaded", "free games", game counts, ROMs/ISOs, backup loaders, "full library" all block the export. | `listing.py` |
| `no_preloaded_games` gates `listable` in code **and** as a CHECK constraint, so a hand-typed `UPDATE` can't skip it either. Same for the storage wipe. | `states.py`, `migrations/0001_init.sql` |
| `unit_events` and `listings` are append-only (triggers). Units are never deleted. | `0001_init.sql` |

There's no payload library, no "auto-apply mod", no file serving to consoles,
and no internet dependency. If a future request asks for any of those, the
answer is no. Point at section 8 of the build brief.

## The bench flow

1. **Intake.** Scan the unit's intake barcode on the home page (a Bluetooth/USB
   scanner paired with the phone just types into the field). A known barcode
   opens its record; a new one opens a fresh one.
2. **Network.** Plug in the console and power it on. The passive DHCP watcher
   sees it join, and it shows up under *New on the bench LAN*. The vendor comes
   from the MAC's OUI (maker only, never the model). Attach it to the unit.
3. **Firmware.** Optional: open `http://bench.lan/c` (or the Pi's IP) in the
   console's own browser. PS3, PS4 and PSP announce their firmware in the
   User-Agent, so the unit's firmware gets pre-filled as *detected*. Wii and
   Xbox 360 browsers identify the console but not the firmware. The page shows
   a 4-letter code the tech can type into the unit to link it if the watcher's
   off. The tech confirms firmware from the system screen either way.
4. **QC.** Start QC. The checklist comes from the unit's family. Tap Pass, Fail
   or N/A per item (a fail needs a note), attach photos, clips or logs where useful,
   then complete the sheet. Completed sheets are locked; re-test with a new run.
5. **Work.** Log repairs (recap, drive service, thermal paste…). Record a mod if
   one was done. Wipe storage and record how.
6. **Compliance.** The tech attests: no preloaded games. Set the cosmetic
   grade. Shoot the photo set (front/back/ports/serial).
7. **Listing.** Draft (copy is seeded from the record), set the price, export.
   You get a JS snippet to paste into `products.js`, the same as JSON, and a
   zip with the front photo at its site path.
8. **Sold.** Attach the order/Stripe reference. Stock in `products.js` doesn't
   decrement itself, so set it to 0.

### States and gates

```
received → tested → refurbished → listable → listed → sold
    └──────────┴──────────┴────────────┴──────────┴──→ failed (reason)
failed → received (reopen, reason)      listable → refurbished (pull back, reason)
```

| To | Needs |
|---|---|
| tested | family set; a completed QC sheet for that family |
| refurbished | latest sheet has no blocking fails **and post-dates the last repair/mod**; storage wiped (if writable) **after** any mod |
| listable | all of the above; attestation recorded **after** the wipe and the mod; cosmetic grade |
| listed | only through Export (sets `listing_id`) |
| sold | a sale reference |

The ordering rules are the point: "passed QC once, then someone opened it up"
and "attested, then modded" both block until the step is redone. Records lock
at `listable`; pull back to change one. Every change, not just transitions,
lands in `unit_events` with who/when/old→new.

## What the export looks like

The brief says the product has `price`. **The real store reads `priceCents`**
(`lib/checkout-core.js`: `unit_amount: product.priceCents`), and also needs
`platform`, a single `image` string (checkout calls `image.replace`) and
`shippingClass`. A `price` field would reach Stripe with no amount. So the
export matches the real file, key for key:

```js
  {
    id: "ps3-cech-2501a-b-0001",
    name: "PlayStation 3 Console — CECH-2501A",
    platform: "PlayStation 3",
    category: "console",
    condition: "refurbished",
    priceCents: 18500,
    stock: 1,
    shippingClass: "console",
    image: "assets/store/units/ps3-cech-2501a-b-0001.jpg",
    blurb: "Refurbished on our bench: thermal paste replaced. Passed 11 QC checks covering …",
    details: [
      "Model: CECH-2501A",
      "Cosmetic grade: A — Light scuffs on the top panel",
      …
    ]
  },
```

`tests/test_listing.py` pastes a generated snippet into a copy of the real
`data/products.js` and runs the real `priceOrder` + `buildSessionPayload` on it.
That test fails if the field is renamed to `price`. Prices are typed in dollars
and parsed to cents with string arithmetic, never `float`. The database stores
integers in STRICT tables. The id slug carries the unit's code, so a sale on the
site traces back to the physical unit.

Disclosures the draft adds by itself: advisory QC fails ("Known issue: …") and
`Modified: <mod type>` if a mod was recorded. Export warns if you delete the
mod line.

## Install on the Pi

From this `bench/` directory, copied onto the Pi:

```bash
sudo useradd --system --home /opt/bench-ops --shell /usr/sbin/nologin bench
sudo mkdir -p /opt/bench-ops && sudo cp -r bench_ops requirements.txt /opt/bench-ops/
cd /opt/bench-ops && sudo python3 -m venv .venv && sudo .venv/bin/pip install -r requirements.txt
sudo cp deploy/bench-ops.env.example /etc/bench-ops.env      # edit BENCH_WATCH_IFACE
sudo cp deploy/bench-ops.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now bench-ops
```

Then open `http://<pi-ip>/` on the bench phone and add yourself on the *Sign in* page.

- **Pi as the bench LAN's DHCP server:** see `deploy/dnsmasq-bench.conf.example`.
  With a separate router you don't need it: the watcher is passive and sees DHCP
  broadcasts either way.
- **Scanner plugged into the Pi** (not the phone): set `BENCH_SCANNER_DEVICE` to
  its `/dev/input/by-id/…-event-kbd` path. Scans land on `/monitor`, which
  refreshes itself with a meta tag.
- **Port 80 + DHCP sniffing** come from the two capabilities in the unit file
  (`CAP_NET_BIND_SERVICE`, `CAP_NET_RAW`). Without them the watcher logs one
  warning and stays off. Nothing else depends on it.
- **Backups:** the database is `/var/lib/bench-ops/bench.db`; photos are in
  `/var/lib/bench-ops/media/`. Copy both. Use `sqlite3 bench.db ".backup x.db"`
  for a consistent DB copy while it's running.

| Env var | Default | |
|---|---|---|
| `BENCH_DATA_DIR` | `./var` | DB + media |
| `BENCH_HOST` / `BENCH_PORT` | `0.0.0.0` / `80` | |
| `BENCH_WATCH_IFACE` | unset (off) | interface facing the bench LAN |
| `BENCH_SCANNER_DEVICE` | unset (off) | evdev path of a Pi-attached scanner |

## Develop

```bash
cd bench
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest            # 122 tests, ~3 s
BENCH_DATA_DIR=./var BENCH_PORT=8000 .venv/bin/python -m bench_ops serve
```

The contract test against the storefront runs when this directory sits inside
the dhole.dev site checkout and `node` is on the PATH. Otherwise it skips.

**MAC vendor table:** `bench_ops/oui_data.py` is generated from the IEEE
registry (Nintendo, Sony Interactive Entertainment, Microsoft only). To refresh:
`python tools/build_oui_table.py oui.txt`.

**QC templates** are seeded from `bench_ops/families.py` on first start, then
edited in the UI (`/qc-templates`). Changing `families.py` later doesn't touch
an existing database. Runs copy their items when they start, so template
edits never rewrite past results.

## Decisions worth knowing

- **Repair log added.** The brief's data model has no field for repairs, but §6
  wants copy that says "recapped, drive-serviced". So: a minimal `repairs` table.
- **Two backward moves** (`failed → received`, `listable → refurbished`), each
  needing a reason. Without them a typo after `listable` is permanent.
- **Network devices are offered, not auto-opened**: the tech's own phone is on
  the bench LAN too.
- **DHCP fingerprints are learned, not shipped.** Option 55 lists are stored raw.
  When a tech attaches a device to a unit with a confirmed family, that
  fingerprint→family pairing is remembered for next time. No guessed fingerprint
  table.
- **Tech identity is a name picker with a cookie, not a password.** It's there
  for attribution on an isolated LAN, not security. Keep the bench Wi-Fi
  password-protected.

## Not built (nice-to-haves from §9.8, or needs a decision)

- Label printing, SMART reads, mDNS advertising.
- Photo resizing on export: bench photos go out full-size. Pillow would fix it.
- `region` and "what's in the box" fields: every console in `products.js` lists
  both in `details`. For now the tech types them into the draft.

"""Listing export: a draft product in the storefront's exact shape.

THE SHAPE is the real one in the site's data/products.js, not the field list
in the build brief. The brief says `price`; the store and its checkout
Function read `priceCents` (lib/checkout-core.js: unit_amount =
product.priceCents), plus `platform`, `image` (a single string -- checkout
calls image.replace) and `shippingClass`. A product with `price` instead of
`priceCents` would reach Stripe with no amount. PRODUCT_KEYS below is that
shape in the file's own key order; tests/test_listing.py checks it against
the real file when this sits in the site repo.

Nothing here writes to the site. It produces a snippet the operator commits.
"""

import io
import json
import re
import zipfile
from pathlib import Path

from . import families, qc, units
from .db import now, one, tx
from .money import require_cents
from .states import transition
from .units import BenchError, code

PRODUCT_KEYS = ("id", "name", "platform", "category", "condition", "priceCents", "stock",
                "shippingClass", "image", "blurb", "details")

CONDITIONS = ("refurbished", "used-good", "used-fair")  # keys of the store's CONDITION_LABELS, minus "new"

IMAGE_DIR = "assets/store/units"  # where the operator puts the photo in the site repo

# House line on every console listing in products.js today.
STANDARD_DETAILS = ["30-day return window if it does not power on"]

SECTION_WORDS = {
    "Power": "power and boot",
    "A/V output": "A/V output",
    "Controller ports": "controller ports",
    "Controls": "controls",
    "Storage / media": "drive and storage",
    "Network": "networking",
    "Battery / RTC": "battery and clock",
}

# Listing copy must never sell piracy (brief section 6). Free-text QC notes
# and the mod description feed the draft, so the export lints everything.
BANNED = [
    (re.compile(r"\bfree\s+games?\b", re.I), "free games"),
    (re.compile(r"\b(?:pre-?loaded|pre-?installed|comes\s+loaded|fully\s+loaded|loaded\s+(?:with|up))\b", re.I), "preloaded / comes loaded"),
    (re.compile(r"\bgames?\s+(?:included|installed|on\s+(?:the\s+)?(?:hdd|drive|card|storage))\b", re.I), "games included/installed"),
    (re.compile(r"\b(?:\d{2,}[\d,]*|\d+\s*\+)\s*(?:games|titles|roms|isos)\b", re.I), "a game count"),
    (re.compile(r"(?<!-)\broms?\b", re.I), "ROMs"),  # not CD-ROM / DVD-ROM
    (re.compile(r"\bisos?\b", re.I), "ISOs"),
    (re.compile(r"\bgame\s+backups?\b|\bbackup\s+(?:loader|manager)s?\b", re.I), "backup loaders"),
    (re.compile(r"\bpira(?:cy|ted|te)\b|\bwarez\b|\bcracked\b", re.I), "piracy"),
    (re.compile(r"\b(?:entire|full|whole)\s+(?:game\s+)?(?:library|collection)\b", re.I), "a full library"),
    (re.compile(r"\bplay\s+(?:any|all)\s+games?\b|\bdownload(?:ed)?\s+games?\b", re.I), "play/download any game"),
]


def lint(texts):
    """-> list of problems. Empty = clean."""
    found = []
    for text in texts:
        for pattern, what in BANNED:
            m = pattern.search(text or "")
            if m:
                found.append(f"mentions {what} (\u201c{m.group(0)}\u201d)")
    return sorted(set(found))


def slug(unit):
    fam = families.get(unit["console_family"])
    parts = [fam.key if fam else "console", unit["model_revision"] or "", code(unit)]
    s = re.sub(r"[^a-z0-9]+", "-", " ".join(parts).lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)[:80]


def _join(words):
    words = list(words)
    if len(words) <= 1:
        return "".join(words)
    return ", ".join(words[:-1]) + " and " + words[-1]


def generate_copy(conn, unit):
    """Seed blurb + details from the record. Leads with the refurb value."""
    fam = families.get(unit["console_family"])
    work = units.repairs(conn, unit["id"])
    run = qc.latest_complete_run(conn, unit["id"])
    rows = qc.results(conn, run["id"]) if run else []

    work_phrases = []
    for r in work:
        phrase = families.REPAIR_KINDS[r["kind"]] if r["kind"] != "other" else r["description"]
        if r["kind"] != "other" and r["description"]:
            phrase = f"{phrase} ({r['description']})"
        if phrase and phrase not in work_phrases:
            work_phrases.append(phrase)

    passed = [r for r in rows if r["result"] == "pass" and not r["photo_slot"]]
    sections = []
    for r in passed:
        word = SECTION_WORDS.get(r["section"], r["section"].lower())
        if word not in sections:
            sections.append(word)

    blurb = []
    if work_phrases:
        blurb.append("Refurbished on our bench: " + _join(p[0].lower() + p[1:] for p in work_phrases) + ".")
    else:
        blurb.append("Bench-tested on our QC checklist.")
    if passed:
        blurb.append(f"Passed {len(passed)} QC checks covering {_join(sections)}.")
    if unit["has_writable_storage"] and unit["storage_wiped"]:
        blurb.append("Storage wiped back to a clean state before sale.")

    details = []
    if unit["model_revision"]:
        details.append(f"Model: {unit['model_revision']}")
    if unit["cosmetic_grade"]:
        g = f"Cosmetic grade: {unit['cosmetic_grade']}"
        details.append(g + (f" \u2014 {unit['cosmetic_notes']}" if unit["cosmetic_notes"] else ""))
    if sections:
        details.append("QC passed: " + ", ".join(sections))
    if work_phrases:
        details.append("Work done: " + "; ".join(work_phrases))
    for r in rows:
        if r["result"] == "fail" and not r["blocking"]:
            details.append(f"Known issue: {r['label']}" + (f" \u2014 {r['note']}" if r["note"] else ""))
    for r in rows:
        if r["result"] == "pass" and r["note"] and not r["photo_slot"]:
            details.append(f"QC note ({r['label']}): {r['note']}")
    if unit["mod_performed"]:
        details.append(f"Modified: {unit['mod_type']}")
    details += STANDARD_DETAILS

    name = f"{fam.name if fam else 'Console'} {fam.noun if fam else ''}".strip()
    if unit["model_revision"]:
        name += f" \u2014 {unit['model_revision']}"
    return {"name": name, "blurb": " ".join(blurb), "details": details}


def get_draft(conn, unit, actor=None):
    """The saved draft, creating it from generate_copy on first visit."""
    d = one(conn, "SELECT * FROM listing_drafts WHERE unit_id = ?", (unit["id"],))
    if d:
        return d
    c = generate_copy(conn, unit)
    with tx(conn):
        conn.execute("INSERT INTO listing_drafts (unit_id, name, price_cents, condition, blurb, details, updated_at, updated_by)"
                     " VALUES (?, ?, NULL, 'refurbished', ?, ?, ?, ?)",
                     (unit["id"], c["name"], c["blurb"], "\n".join(c["details"]), now(), actor.tech_id if actor else None))
    return one(conn, "SELECT * FROM listing_drafts WHERE unit_id = ?", (unit["id"],))


def save_draft(conn, actor, unit_id, name, price_cents, condition, blurb, details_text):
    unit = units.get(conn, unit_id)
    if unit["status"] not in ("refurbished", "listable"):
        raise BenchError("Listings are drafted once a unit is refurbished.")
    if condition not in CONDITIONS:
        raise BenchError("Pick a condition.")
    name = " ".join((name or "").split())[:120]
    if not name:
        raise BenchError("Name can't be blank.")
    if price_cents is not None:
        require_cents(price_cents)
    details = [" ".join(line.split()) for line in (details_text or "").splitlines()]
    details = [d[:300] for d in details if d][:20]
    get_draft(conn, unit, actor)
    with tx(conn):
        conn.execute("UPDATE listing_drafts SET name = ?, price_cents = ?, condition = ?, blurb = ?, details = ?,"
                     " updated_at = ?, updated_by = ? WHERE unit_id = ?",
                     (name, price_cents, condition, " ".join((blurb or "").split())[:1000], "\n".join(details),
                      now(), actor.tech_id, unit_id))
        units.log_event(conn, unit_id, actor, "listing_draft_saved", {"price_cents": price_cents})


def regenerate(conn, actor, unit_id):
    unit = units.get(conn, unit_id)
    c = generate_copy(conn, unit)
    d = get_draft(conn, unit, actor)
    save_draft(conn, actor, unit_id, c["name"], d["price_cents"], d["condition"], c["blurb"], "\n".join(c["details"]))


def build_product(conn, unit, draft):
    """-> (product dict in PRODUCT_KEYS order, front photo row, problems)."""
    fam = families.get(unit["console_family"])
    photo = units.photo_set(conn, unit["id"]).get("front")
    problems = []
    if not fam:
        problems.append("console family not set")
    if draft["price_cents"] is None:
        problems.append("set a price")
    if not photo:
        problems.append("attach a front photo (the store shows one real photo per product)")
    details = [d for d in draft["details"].split("\n") if d]
    problems += lint([draft["name"], draft["blurb"], *details])
    pid = slug(unit)
    ext = photo["stored_name"].rsplit(".", 1)[-1] if photo else "jpg"
    product = {
        "id": pid,
        "name": draft["name"],
        "platform": fam.platform if fam else "",
        "category": "console",
        "condition": draft["condition"],
        "priceCents": draft["price_cents"],
        "stock": 1,
        "shippingClass": fam.shipping_class if fam else "console",
        "image": f"{IMAGE_DIR}/{pid}.{ext}",
        "blurb": draft["blurb"],
        "details": details,
    }
    assert tuple(product) == PRODUCT_KEYS
    return product, photo, problems


def warnings(unit, draft):
    out = []
    if unit["mod_performed"] and not any(d.startswith("Modified") for d in draft["details"].split("\n")):
        out.append("This unit is modified but the details don't say so. Buyers should be told.")
    return out


# --- output formats --------------------------------------------------------

def _js_string(s):
    # JSON string syntax is valid JS; escape the two line separators old
    # engines choke on.
    return json.dumps(s, ensure_ascii=False).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def to_js(product):
    """Formatted like an entry in products.js: 2-space indent inside the
    `products` array, unquoted keys, trailing comma. Paste it in as-is."""
    require_cents(product["priceCents"])
    lines = ["  {"]
    keys = list(product)
    for i, key in enumerate(keys):
        value = product[key]
        comma = "," if i < len(keys) - 1 else ""
        if isinstance(value, list):
            inner = [f"      {_js_string(v)}" for v in value]
            body = ",\n".join(inner)
            lines.append(f"    {key}: [\n{body}\n    ]{comma}" if inner else f"    {key}: []{comma}")
        elif type(value) is int:
            lines.append(f"    {key}: {value}{comma}")
        else:
            lines.append(f"    {key}: {_js_string(value)}{comma}")
    lines.append("  },")
    return "\n".join(lines) + "\n"


def to_json(product):
    require_cents(product["priceCents"])
    return json.dumps(product, indent=2, ensure_ascii=False) + "\n"


def export(conn, actor, unit_id):
    """Snapshot the listing and move the unit to `listed`. -> listings row."""
    unit = units.get(conn, unit_id)
    if unit["status"] != "listable":
        raise BenchError(f"{code(unit)} is {unit['status']}; only listable units are exported.")
    draft = get_draft(conn, unit, actor)
    product, photo, problems = build_product(conn, unit, draft)
    if problems:
        raise BenchError("Can't export yet: " + "; ".join(problems))
    with tx(conn):
        cur = conn.execute("INSERT INTO listings (unit_id, product_id, product_json, price_cents, photo_id, exported_at,"
                           " exported_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (unit_id, product["id"], json.dumps(product, ensure_ascii=False), product["priceCents"],
                            photo["id"], now(), actor.tech_id))
        units.log_event(conn, unit_id, actor, "listing_exported", {"listing_row": cur.lastrowid,
                                                                    "product_id": product["id"],
                                                                    "price_cents": product["priceCents"]})
        transition(conn, actor, unit_id, "listed", listing_id=product["id"])
        return one(conn, "SELECT * FROM listings WHERE id = ?", (cur.lastrowid,))


def latest_export(conn, unit_id):
    return one(conn, "SELECT * FROM listings WHERE unit_id = ? ORDER BY id DESC LIMIT 1", (unit_id,))


def bundle(conn, listing_row, media_dir):
    """Zip: the photo at its site path, plus the JS and JSON snippets."""
    product = json.loads(listing_row["product_json"])
    photo = one(conn, "SELECT * FROM attachments WHERE id = ?", (listing_row["photo_id"],))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(Path(media_dir) / photo["stored_name"], product["image"])
        z.writestr(f"bench-export/{product['id']}.js", to_js(product))
        z.writestr(f"bench-export/{product['id']}.json", to_json(product))
        z.writestr("bench-export/README.txt", (
            f"Listing export for {product['id']}\n\n"
            f"1. Copy {product['image']} into the site repo at the same path.\n"
            f"2. Paste bench-export/{product['id']}.js into the `products` array in data/products.js.\n"
            "3. npm test, commit, push. Merging to main deploys.\n\n"
            "Photos come straight off the bench camera. Resize before committing if they're large.\n"
        ))
    return buf.getvalue()

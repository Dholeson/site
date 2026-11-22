import io
import json
import shutil
import subprocess
import zipfile

import pytest

from bench_ops import listing, units
from bench_ops.money import PriceError, format_cents, parse_price, require_cents
from bench_ops.units import BenchError

from .conftest import SITE_ROOT, to_listable


@pytest.mark.parametrize("text,cents", [
    ("145", 14500), ("145.00", 14500), ("145.5", 14550), ("145.05", 14505), ("0.99", 99),
    ("$145", 14500), (" 1,450.00 ", 145000), ("0.10", 10),
])
def test_parse_price(text, cents):
    assert parse_price(text) == cents and type(parse_price(text)) is int


@pytest.mark.parametrize("text", ["", "abc", "145.999", "-5", "1e3", "145.00.0", "0", "0.00", "99999999", ".5"])
def test_parse_price_rejects(text):
    with pytest.raises(PriceError):
        parse_price(text)


def test_require_cents_rejects_floats_and_bools():
    for bad in (145.0, True, "14500", 0, -1, None):
        with pytest.raises(PriceError):
            require_cents(bad)
    assert format_cents(14505) == "$145.05"


def test_lint_catches_piracy_copy():
    assert listing.lint(["Comes loaded with 500 games!"])
    assert listing.lint(["Free games included"])
    assert listing.lint(["Preloaded with ROMs and ISOs"])
    assert listing.lint(["Has a backup loader installed"])
    assert listing.lint(["Full library on the HDD"])
    assert listing.lint(["100+ titles"])


def test_lint_allows_honest_refurb_copy():
    assert listing.lint([
        "Refurbished on our bench: recapped and disc drive serviced.",
        "CD-ROM drive read-tested with a known-good disc",
        "Backup battery replaced",
        "Modified: homebrew enabled",
        "Storage wiped back to a clean state before sale.",
        "Passed 14 QC checks covering power and boot, A/V output and controller ports.",
    ]) == []


def test_draft_copy_leads_with_the_refurb_value(conn, tech, media_dir):
    from bench_ops import states
    u = to_listable(conn, tech, media_dir)
    # pull back to refurbished to log more work
    states.transition(conn, tech, u["id"], "refurbished", reason="add work log")
    units.add_repair(conn, tech, u["id"], "recap", "")
    units.add_repair(conn, tech, u["id"], "drive_service", "laser cleaned")
    c = listing.generate_copy(conn, units.get(conn, u["id"]))
    assert c["blurb"].startswith("Refurbished on our bench: recapped and disc drive serviced (laser cleaned).")
    assert "Storage wiped back to a clean state" in c["blurb"]
    assert c["name"] == "PlayStation 3 Console — CECH-2501A"
    assert "Cosmetic grade: A — Light scuffs on the top" in c["details"]
    assert listing.lint([c["name"], c["blurb"], *c["details"]]) == []


def test_mod_is_disclosed(conn, tech, media_dir):
    u = units.create(conn, tech, barcode="X", family="wii")
    units.record_mod(conn, tech, u["id"], "homebrew enabled", "SOP-WII-01", "4.3U")
    c = listing.generate_copy(conn, units.get(conn, u["id"]))
    assert "Modified: homebrew enabled" in c["details"]


def test_product_shape_and_js_format(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    listing.save_draft(conn, tech, u["id"], "PlayStation 3 Console — CECH-2501A", 18500, "refurbished",
                       'Says "hi".', "Model: CECH-2501A\nCosmetic grade: A")
    product, photo, problems = listing.build_product(conn, u, listing.get_draft(conn, u))
    assert problems == []
    assert tuple(product) == listing.PRODUCT_KEYS
    assert product["priceCents"] == 18500 and type(product["priceCents"]) is int
    assert product["stock"] == 1 and product["shippingClass"] == "console" and product["platform"] == "PlayStation 3"
    assert product["id"] == "ps3-cech-2501a-b-0001"
    assert product["image"] == "assets/store/units/ps3-cech-2501a-b-0001.jpg"
    assert listing.to_js(product) == (
        '  {\n'
        '    id: "ps3-cech-2501a-b-0001",\n'
        '    name: "PlayStation 3 Console — CECH-2501A",\n'
        '    platform: "PlayStation 3",\n'
        '    category: "console",\n'
        '    condition: "refurbished",\n'
        '    priceCents: 18500,\n'
        '    stock: 1,\n'
        '    shippingClass: "console",\n'
        '    image: "assets/store/units/ps3-cech-2501a-b-0001.jpg",\n'
        '    blurb: "Says \\"hi\\".",\n'
        '    details: [\n'
        '      "Model: CECH-2501A",\n'
        '      "Cosmetic grade: A"\n'
        '    ]\n'
        '  },\n'
    )
    assert json.loads(listing.to_json(product)) == product


def test_psp_ships_small(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir, family="psp", model="PSP-3001")
    listing.save_draft(conn, tech, u["id"], "PSP Handheld", 9000, "refurbished", "b", "d")
    product, _, _ = listing.build_product(conn, u, listing.get_draft(conn, u))
    assert product["shippingClass"] == "small" and product["platform"] == "PSP"


def test_export_blocks_until_clean(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    with pytest.raises(BenchError, match="set a price"):
        listing.export(conn, tech, u["id"])
    listing.save_draft(conn, tech, u["id"], "PS3", 18500, "refurbished", "Comes loaded with games", "x")
    with pytest.raises(BenchError, match="preloaded"):
        listing.export(conn, tech, u["id"])
    assert units.get(conn, u["id"])["status"] == "listable"


def test_export_needs_a_real_front_photo(conn, tech, media_dir):
    from bench_ops import states
    u = units.create(conn, tech, barcode="X", family="gc")
    from .conftest import pass_qc
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    states.transition(conn, tech, u["id"], "refurbished")
    units.attest_no_games(conn, tech, u["id"])
    units.set_grade(conn, tech, u["id"], "B", "")
    states.transition(conn, tech, u["id"], "listable")
    listing.save_draft(conn, tech, u["id"], "GameCube Console", 9900, "refurbished", "b", "d")
    with pytest.raises(BenchError, match="front photo"):
        listing.export(conn, tech, u["id"])


def test_export_snapshots_and_bundles(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    listing.save_draft(conn, tech, u["id"], "PS3", 18500, "refurbished", "b", "d")
    row = listing.export(conn, tech, u["id"])
    u = units.get(conn, u["id"])
    assert u["status"] == "listed" and u["listing_id"] == row["product_id"] == "ps3-cech-2501a-b-0001"
    z = zipfile.ZipFile(io.BytesIO(listing.bundle(conn, row, media_dir)))
    names = set(z.namelist())
    assert "assets/store/units/ps3-cech-2501a-b-0001.jpg" in names
    assert "bench-export/ps3-cech-2501a-b-0001.js" in names and "bench-export/ps3-cech-2501a-b-0001.json" in names
    with pytest.raises(Exception, match="append-only"):
        conn.execute("UPDATE listings SET price_cents = 1")


# --- contract with the real storefront ---------------------------------------

PRODUCTS_JS = SITE_ROOT / "data" / "products.js"
CHECKOUT_CORE = SITE_ROOT / "lib" / "checkout-core.js"


@pytest.mark.skipif(not (PRODUCTS_JS.exists() and CHECKOUT_CORE.exists() and shutil.which("node")),
                    reason="needs the dhole.dev site checkout (../data/products.js) and node")
def test_export_matches_the_real_products_js_and_checkout(conn, tech, media_dir, tmp_path):
    """Paste the snippet into a copy of the real catalogue and run the real
    checkout pricing on it. Catches a renamed field (price vs priceCents)."""
    u = to_listable(conn, tech, media_dir)
    listing.save_draft(conn, tech, u["id"], "PlayStation 3 Console", 18500, "refurbished", "Blurb.", "Line one")
    product, _, problems = listing.build_product(conn, u, listing.get_draft(conn, u))
    assert problems == []
    snippet = listing.to_js(product)

    # Exactly what the operator does: paste into the array.
    src = PRODUCTS_JS.read_text(encoding="utf-8")
    marker = "export const products = [\n"
    assert marker in src
    (tmp_path / "data").mkdir()
    (tmp_path / "lib").mkdir()
    (tmp_path / "data" / "products.js").write_text(src.replace(marker, marker + snippet, 1), encoding="utf-8")
    shutil.copy(CHECKOUT_CORE, tmp_path / "lib" / "checkout-core.js")
    (tmp_path / "package.json").write_text('{"type": "module"}')
    check = tmp_path / "check.mjs"
    check.write_text("""
import { products } from "./data/products.js";
import { priceOrder, buildSessionPayload } from "./lib/checkout-core.js";
const mine = products[0];
const theirs = products.find(p => p.category === "console" && p !== mine);
const out = {
  sameKeys: JSON.stringify(Object.keys(mine)) === JSON.stringify(Object.keys(theirs)),
  sameTypes: Object.keys(theirs).every(k => typeof mine[k] === typeof theirs[k] && Array.isArray(mine[k]) === Array.isArray(theirs[k])),
  integerCents: Number.isInteger(mine.priceCents),
  uniqueId: products.filter(p => p.id === mine.id).length === 1,
};
const { priced, error } = priceOrder([{ id: mine.id, qty: 1 }]);
out.priceError = error || null;
const payload = buildSessionPayload(priced, { siteUrl: "https://dhole.dev", currency: "usd", automaticTax: false, shipToCountries: ["US"] });
out.unitAmount = payload.line_items[0].price_data.unit_amount;
out.image = payload.line_items[0].price_data.product_data.images[0];
console.log(JSON.stringify(out));
""")
    res = subprocess.run(["node", str(check)], cwd=tmp_path, capture_output=True, text=True, timeout=30)
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out == {"sameKeys": True, "sameTypes": True, "integerCents": True, "uniqueId": True, "priceError": None,
                   "unitAmount": 18500, "image": "https://dhole.dev/assets/store/units/ps3-cech-2501a-b-0001.jpg"}

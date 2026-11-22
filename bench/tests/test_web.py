"""HTTP-level checks: the console boundary, no-script guarantee, and the whole
bench flow driven through the forms a tech actually uses."""

import re
from pathlib import Path

from bench_ops import web

from .conftest import JPEG

PS3_UA = "Mozilla/5.0 (PLAYSTATION 3 4.88) AppleWebKit/531.22.8 (KHTML, like Gecko)"
TEMPLATES = Path(web.__file__).parent / "templates"


def post(c, url, data=None, files=None, referer=None):
    r = c.post(url, data=data or {}, files=files, follow_redirects=False,
               headers={"referer": f"http://testserver{referer or url}"})
    assert r.status_code == 303, (r.status_code, r.text[:300])
    loc = r.headers["location"]
    assert "err=" not in loc, loc
    return loc


# --- the line --------------------------------------------------------------

def test_no_template_contains_a_script():
    for path in TEMPLATES.glob("*.html"):
        text = path.read_text().lower()
        assert "<script" not in text, path.name
        assert not re.search(r"\son[a-z]+\s*=", text), f"inline event handler in {path.name}"
        assert "javascript:" not in text, path.name


def test_every_response_forbids_scripts(signed_in):
    for url in ["/", "/units", "/network", "/qc-templates", "/monitor", "/who", "/c", "/healthz",
                "/static/bench.css", "/nope"]:
        r = signed_in.get(url)
        assert "script-src 'none'" in r.headers["content-security-policy"], url
        assert r.headers["x-content-type-options"] == "nosniff"


def test_console_gets_only_the_intake_page(signed_in):
    h = {"user-agent": PS3_UA}
    r = signed_in.get("/", headers=h)
    assert r.status_code == 200 and "Bench intake" in r.text and "<form" not in r.text
    assert signed_in.get("/c", headers=h).status_code == 200
    assert signed_in.get("/static/bench.css", headers=h).status_code == 200
    for url in ["/units", "/network", "/media/1", "/units/1/listing.zip", "/qc-templates"]:
        assert signed_in.get(url, headers=h).status_code == 403, url
    assert signed_in.post("/scan", data={"barcode": "X"}, headers=h).status_code == 403
    assert signed_in.post("/c", headers=h).status_code == 403


def test_intake_page_prefills_the_linked_unit(signed_in, settings):
    Path(settings.arp_path).write_text(
        "IP address       HW type     Flags       HW address            Mask     Device\n"
        "testclient       0x1         0x2         00:19:c5:12:34:56     *        eth0\n")
    r = signed_in.get("/c", headers={"user-agent": PS3_UA})
    code = re.search(r'class="code">(\w{4})<', r.text).group(1)
    assert "PlayStation 3" in r.text and "4.88" in r.text and "00:19:C5:12:34:56" in r.text
    loc = post(signed_in, "/scan", {"barcode": "B-0042"}, referer="/")
    unit_url = loc.split("?")[0]
    post(signed_in, f"{unit_url}/link-device", {"code": code}, referer=unit_url)
    page = signed_in.get(unit_url).text
    assert "4.88" in page and "detected, not confirmed" in page and "00:19:C5:12:34:56" in page


def test_changes_need_a_signed_in_tech(client):
    r = client.post("/scan", data={"barcode": "X"}, follow_redirects=False, headers={"referer": "http://testserver/"})
    assert r.status_code == 303 and r.headers["location"].startswith("/who?")


def test_errors_come_back_as_a_message(signed_in):
    r = signed_in.post("/scan", data={"barcode": "  "}, follow_redirects=False,
                       headers={"referer": "http://testserver/"})
    assert "err=" in r.headers["location"]


def test_upload_refusals_are_friendly(signed_in):
    loc = post(signed_in, "/scan", {"barcode": "B-1"}, referer="/").split("?")[0]
    r = signed_in.post(f"{loc}/files", files={"file": ("game.iso", b"\x00" * 40000 + b"CD001", "application/octet-stream")},
                       follow_redirects=False, headers={"referer": f"http://testserver{loc}"})
    assert r.status_code == 303 and "err=" in r.headers["location"]


# --- the whole bench flow, through the UI ---------------------------------

def test_full_flow_through_the_forms(signed_in):
    c = signed_in
    unit = post(c, "/scan", {"barcode": "B-0001"}, referer="/").split("?")[0]
    post(c, f"{unit}/identity", {"console_family": "ps3", "model_revision": "CECH-2501A", "serial_no": "CG123"})
    post(c, f"{unit}/firmware", {"firmware_version": "4.90"})

    qc_url = post(c, f"{unit}/qc").split("#")[0]
    page = c.get(qc_url).text
    item_ids = re.findall(r'action="(/units/\d+/qc/\d+/items/\d+)"', page)
    assert len(item_ids) > 10
    for action in item_ids:
        post(c, action, {"result": "pass"}, referer=qc_url)
    post(c, f"{qc_url}/complete", referer=qc_url)

    post(c, f"{unit}/transition", {"to": "tested"})
    post(c, f"{unit}/repairs", {"kind": "thermal", "description": ""})
    # repair after QC -> must re-test before refurbished
    r = c.post(f"{unit}/transition", data={"to": "refurbished"}, follow_redirects=False,
               headers={"referer": f"http://testserver{unit}"})
    assert "re-run+QC" in r.headers["location"] or "re-run%20QC" in r.headers["location"]
    qc2 = post(c, f"{unit}/qc").split("#")[0]
    for action in re.findall(r'action="(/units/\d+/qc/\d+/items/\d+)"', c.get(qc2).text):
        post(c, action, {"result": "pass"}, referer=qc2)
    post(c, f"{qc2}/complete", referer=qc2)

    post(c, f"{unit}/wipe", {"method": "Console factory reset / initialise"})
    post(c, f"{unit}/transition", {"to": "refurbished"})
    post(c, f"{unit}/attest", {"confirm": "yes"})
    post(c, f"{unit}/grade", {"grade": "A", "notes": "Clean"})
    post(c, f"{unit}/photos", {"slot": "front"}, files={"file": ("front.jpg", JPEG, "image/jpeg")})
    post(c, f"{unit}/transition", {"to": "listable"})

    post(c, f"{unit}/listing", {"name": "PlayStation 3 Console — CECH-2501A", "price": "185",
                                "condition": "refurbished", "blurb": "Refurbished on our bench.",
                                "details": "Model: CECH-2501A\nThermal paste replaced"})
    page = c.get(f"{unit}/listing").text
    assert "priceCents: 18500," in page
    post(c, f"{unit}/listing/export", referer=f"{unit}/listing")

    js = c.get(f"{unit}/listing.js")
    assert js.status_code == 200 and "priceCents: 18500," in js.text and "attachment" in js.headers["content-disposition"]
    assert c.get(f"{unit}/listing.json").json()["priceCents"] == 18500
    z = c.get(f"{unit}/listing.zip")
    assert z.status_code == 200 and z.content[:2] == b"PK"

    loc = post(c, f"{unit}/transition", {"to": "sold", "sale_ref": "cs_live_abc"})
    assert "stock" in loc  # reminder that products.js stock doesn't decrement itself
    page = c.get(unit).text
    assert "sold" in page and "cs_live_abc" in page


def test_media_is_served_safely(signed_in):
    unit = post(signed_in, "/scan", {"barcode": "B-2"}, referer="/").split("?")[0]
    post(signed_in, f"{unit}/files", files={"file": ("smart.txt", b"SMART: PASSED\n", "text/plain")})
    post(signed_in, f"{unit}/photos", {"slot": "back"}, files={"file": ("b.jpg", JPEG, "image/jpeg")})
    page = signed_in.get(unit).text
    ids = re.findall(r'href="/media/(\d+)"', page)
    kinds = {}
    for i in set(ids):
        r = signed_in.get(f"/media/{i}")
        kinds[r.headers["content-type"].split(";")[0]] = r.headers["content-disposition"].split(";")[0]
    assert kinds == {"text/plain": "attachment", "image/jpeg": "inline"}


def test_sign_in_never_redirects_off_site(client):
    for bad in ["//evil.example/", "/\\evil.example/", "https://evil.example/"]:
        r = client.post("/who", data={"new_name": "Sam", "next": bad}, follow_redirects=False)
        assert r.headers["location"].startswith("/?"), bad

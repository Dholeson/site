import io
import struct
from pathlib import Path

import pytest

from bench_ops import db, qc, units
from bench_ops.config import Settings

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200


@pytest.fixture
def conn(tmp_path):
    c = db.connect(tmp_path / "bench.db")
    db.migrate(c)
    qc.seed_templates(c)
    yield c
    c.close()


@pytest.fixture
def tech(conn):
    row = units.add_tech(conn, "Sam")
    return units.Actor(row["name"], row["id"])


@pytest.fixture
def media_dir(tmp_path):
    d = tmp_path / "media"
    d.mkdir()
    return d


def answer_all(conn, actor, unit_id, run_id, fail=None, fail_note="dead"):
    """Answer every item: pass, except labels in `fail` -> fail."""
    for r in qc.results(conn, run_id):
        if fail and r["label"] in fail:
            qc.record_result(conn, actor, unit_id, run_id, r["id"], "fail", fail_note)
        else:
            qc.record_result(conn, actor, unit_id, run_id, r["id"], "pass")


def pass_qc(conn, actor, unit_id, fail=None):
    run_id = qc.start_run(conn, actor, unit_id)
    answer_all(conn, actor, unit_id, run_id, fail=fail)
    qc.complete_run(conn, actor, unit_id, run_id)
    return run_id


def add_photo(conn, actor, unit_id, media_dir, slot="front"):
    from bench_ops import media
    meta = media.store_upload(io.BytesIO(JPEG), f"{slot}.jpg", media_dir, want="photo")
    return units.add_attachment(conn, actor, unit_id, meta, slot=slot)


def to_listable(conn, actor, media_dir, family="ps3", barcode="B-0001", model="CECH-2501A"):
    """Drive a unit through the whole bench flow to `listable`."""
    from bench_ops import states
    unit = units.create(conn, actor, barcode=barcode, family=family)
    uid = unit["id"]
    units.update_identity(conn, actor, uid, model_revision=model)
    pass_qc(conn, actor, uid)
    states.transition(conn, actor, uid, "tested")
    if units.get(conn, uid)["has_writable_storage"]:
        units.record_wipe(conn, actor, uid, "Console factory reset / initialise")
    states.transition(conn, actor, uid, "refurbished")
    units.attest_no_games(conn, actor, uid)
    units.set_grade(conn, actor, uid, "A", "Light scuffs on the top")
    add_photo(conn, actor, uid, media_dir)
    states.transition(conn, actor, uid, "listable")
    return units.get(conn, uid)


def dhcp_frame(mac, op=1, msg_type=1, hostname=None, prl=None, vendor_class=None, yiaddr="0.0.0.0",
               requested=None, vlan=False):
    macb = bytes.fromhex(mac.replace(":", ""))
    bootp = bytearray(236)
    bootp[0], bootp[1], bootp[2] = op, 1, 6
    bootp[16:20] = bytes(int(x) for x in yiaddr.split("."))
    bootp[28:34] = macb
    opts = bytearray(b"\x63\x82\x53\x63")
    opts += bytes([53, 1, msg_type])
    if hostname:
        opts += bytes([12, len(hostname)]) + hostname.encode()
    if prl:
        opts += bytes([55, len(prl)]) + bytes(prl)
    if vendor_class:
        opts += bytes([60, len(vendor_class)]) + vendor_class.encode()
    if requested:
        opts += bytes([50, 4]) + bytes(int(x) for x in requested.split("."))
    opts += b"\xff"
    payload = bytes(bootp) + bytes(opts)
    sport, dport = (68, 67) if op == 1 else (67, 68)
    udp = struct.pack("!HHHH", sport, dport, 8 + len(payload), 0) + payload
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(udp), 0, 0, 64, 17, 0, b"\x00" * 4, b"\xff" * 4) + udp
    eth = b"\xff" * 6 + macb + (b"\x81\x00\x00\x05" if vlan else b"") + b"\x08\x00"
    return eth + ip


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", start_threads=False, arp_path=str(tmp_path / "arp"))


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient
    from bench_ops.web import create_app
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def signed_in(client):
    client.post("/who", data={"new_name": "Sam", "next": "/"})
    return client


SITE_ROOT = Path(__file__).resolve().parents[2]

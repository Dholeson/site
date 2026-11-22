from bench_ops import devices, dhcp, units
from bench_ops.scanner import KeyDecoder

from .conftest import dhcp_frame

PS3 = "00:19:C5:12:34:56"


def test_parses_a_discover():
    pkt = dhcp.parse_frame(dhcp_frame(PS3, hostname="PS3-LIVING", prl=[1, 3, 6, 15], vendor_class="SCE",
                                      requested="10.42.0.57"))
    assert pkt == {"op": 1, "type": "DISCOVER", "mac": PS3, "ip": "10.42.0.57", "hostname": "PS3-LIVING",
                   "vendor_class": "SCE", "fingerprint": "1,3,6,15"}


def test_parses_a_vlan_tagged_frame():
    assert dhcp.parse_frame(dhcp_frame(PS3, vlan=True))["mac"] == PS3


def test_ack_gives_the_ip_but_no_client_fields():
    pkt = dhcp.parse_frame(dhcp_frame(PS3, op=2, msg_type=5, yiaddr="10.42.0.99", hostname="router-says"))
    assert pkt["ip"] == "10.42.0.99" and pkt["hostname"] is None and pkt["fingerprint"] is None


def test_ignores_junk():
    assert dhcp.parse_frame(b"") is None
    assert dhcp.parse_frame(b"\x00" * 13) is None
    frame = bytearray(dhcp_frame(PS3))
    frame[14 + 20 + 2:14 + 20 + 4] = (53).to_bytes(2, "big")  # DNS, not DHCP
    assert dhcp.parse_frame(bytes(frame)) is None
    assert dhcp.parse_frame(dhcp_frame(PS3)[:200]) is None   # truncated


def test_record_dhcp_and_learn_fingerprints(conn, tech):
    d = devices.record_dhcp(conn, PS3, ip="10.42.0.57", hostname=None, fingerprint="1,3,6,15", vendor_class="SCE")
    assert d["vendor_group"] == "sony" and d["family_hint"] is None and len(d["code"]) == 4
    unit = devices.attach(conn, tech, d["id"])
    assert unit["mac_address"] == PS3
    units.update_identity(conn, tech, unit["id"], console_family="ps3")
    devices.learn(conn, unit["id"])
    other = devices.record_dhcp(conn, "00:19:C5:AA:AA:AA", fingerprint="1,3,6,15", vendor_class="SCE")
    assert other["family_hint"] == "ps3"


def test_attach_prefills_from_the_device(conn, tech):
    d = devices.record_intake_visit(conn, "10.42.0.57", PS3, "Mozilla/5.0 (PLAYSTATION 3 4.88) AppleWebKit/531.22.8")
    unit = devices.attach(conn, tech, d["id"])
    assert unit["console_family"] == "ps3"
    assert unit["firmware_version"] == "4.88" and unit["firmware_source"] == "detected"
    assert unit["firmware_confirmed_by"] is None  # advisory until a tech confirms


def test_detection_never_overwrites_a_confirmed_firmware(conn, tech):
    unit = units.create(conn, tech, barcode="X", family="ps3")
    units.set_firmware_entered(conn, tech, unit["id"], "4.90")
    d = devices.record_intake_visit(conn, "10.42.0.57", PS3, "Mozilla/5.0 (PLAYSTATION 3 4.88)")
    devices.attach(conn, tech, d["id"], unit["id"])
    devices.record_intake_visit(conn, "10.42.0.57", PS3, "Mozilla/5.0 (PLAYSTATION 3 4.88)")
    assert units.get(conn, unit["id"])["firmware_version"] == "4.90"


def test_scanner_key_decoder():
    dec = KeyDecoder()
    # B - 0 0 0 1 <Enter>, with shift held for B
    events = [(42, 1), (48, 1), (48, 0), (42, 0), (12, 1), (11, 1), (11, 1), (11, 1), (2, 1), (28, 1)]
    out = [dec.feed(c, v) for c, v in events]
    assert out[-1] == "B-0001" and all(o is None for o in out[:-1])
    assert dec.feed(28, 1) is None  # empty line

"""Devices seen on the bench LAN, and linking them to unit records.

Two sources feed this table:
  * the DHCP sniffer (bench_ops/dhcp.py) -- MAC, hostname, fingerprint;
  * the console intake page (/c) -- the console's User-Agent.
The appliance OFFERS a record for a new console; the tech attaches it to a
unit (or opens a new one). Nothing is auto-opened: the tech's own tablet is
on this LAN too.
"""

import secrets

from . import families, ident, units
from .db import all_, now, one, tx
from .units import BenchError

CODE_ALPHABET = "ACDEFHJKLMNPQRTUVWXY3479"  # no 0/O, 1/I, 2/Z, 5/S, 6/G, 8/B


def _new_code(conn):
    while True:
        c = "".join(secrets.choice(CODE_ALPHABET) for _ in range(4))
        if not one(conn, "SELECT 1 FROM devices WHERE code = ?", (c,)):
            return c


def fingerprint_key(dhcp_fingerprint, vendor_class):
    if not dhcp_fingerprint and not vendor_class:
        return None
    return f"{dhcp_fingerprint or ''}|{vendor_class or ''}"


def _learned_family(conn, dhcp_fingerprint, vendor_class):
    key = fingerprint_key(dhcp_fingerprint, vendor_class)
    row = one(conn, "SELECT console_family FROM fingerprint_hints WHERE fingerprint = ?", (key,)) if key else None
    return row["console_family"] if row else None


def _refresh_hint(conn, device_id):
    d = one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))
    hint = ident.family_hint(d["vendor_group"], d["hostname"], d["ua_family"],
                             _learned_family(conn, d["dhcp_fingerprint"], d["dhcp_vendor_class"]))
    conn.execute("UPDATE devices SET family_hint = ? WHERE id = ?", (hint, device_id))
    return one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))


def record_dhcp(conn, mac, ip=None, hostname=None, fingerprint=None, vendor_class=None):
    """Called by the sniffer for every client DHCP message (and server ACKs,
    which only carry the IP)."""
    mac = ident.normalize_mac(mac)
    if not mac:
        return None
    vendor_group, vendor_org = ident.vendor_for_mac(mac)
    t = now()
    with tx(conn):
        d = one(conn, "SELECT * FROM devices WHERE mac = ?", (mac,))
        if d:
            conn.execute(
                "UPDATE devices SET last_seen = ?, ip = COALESCE(?, ip), hostname = COALESCE(?, hostname),"
                " dhcp_fingerprint = COALESCE(?, dhcp_fingerprint), dhcp_vendor_class = COALESCE(?, dhcp_vendor_class)"
                " WHERE id = ?", (t, ip, hostname, fingerprint, vendor_class, d["id"]))
            device_id = d["id"]
        else:
            cur = conn.execute(
                "INSERT INTO devices (mac, code, source, first_seen, last_seen, ip, hostname, vendor_group, vendor_org,"
                " randomized_mac, dhcp_fingerprint, dhcp_vendor_class) VALUES (?, ?, 'dhcp', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (mac, _new_code(conn), t, t, ip, hostname, vendor_group, vendor_org, int(ident.is_randomized(mac)),
                 fingerprint, vendor_class))
            device_id = cur.lastrowid
        return _refresh_hint(conn, device_id)


def record_intake_visit(conn, ip, mac, user_agent):
    """The console's browser loaded the intake page. Store what it announced,
    and pre-fill the linked unit (if any). Returns the device row."""
    mac = ident.normalize_mac(mac)
    ua = ident.parse_user_agent(user_agent)
    t = now()
    with tx(conn):
        d = None
        if mac:
            d = one(conn, "SELECT * FROM devices WHERE mac = ?", (mac,))
        if not d and ip:
            # No MAC (routed, or ARP miss): match a MAC-less device on the same IP.
            d = one(conn, "SELECT * FROM devices WHERE mac IS NULL AND ip = ? ORDER BY last_seen DESC LIMIT 1", (ip,))
        if d:
            conn.execute("UPDATE devices SET last_seen = ?, ip = COALESCE(?, ip), user_agent = ?, ua_family = ?,"
                         " ua_firmware = ? WHERE id = ?",
                         (t, ip, (user_agent or "")[:500], ua["family"], ua["firmware"], d["id"]))
            device_id = d["id"]
        else:
            vendor_group, vendor_org = ident.vendor_for_mac(mac)
            cur = conn.execute(
                "INSERT INTO devices (mac, code, source, first_seen, last_seen, ip, vendor_group, vendor_org,"
                " randomized_mac, user_agent, ua_family, ua_firmware) VALUES (?, ?, 'intake-page', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (mac, _new_code(conn), t, t, ip, vendor_group, vendor_org, int(ident.is_randomized(mac)),
                 (user_agent or "")[:500], ua["family"], ua["firmware"]))
            device_id = cur.lastrowid
        d = _refresh_hint(conn, device_id)
        if d["unit_id"]:
            _prefill_unit(conn, d)
    return one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))


def _prefill_unit(conn, d):
    src = {"device_code": d["code"], "user_agent": d["user_agent"]}
    if d["family_hint"]:
        units.prefill_family(conn, units.SYSTEM_INTAKE, d["unit_id"], d["family_hint"], src)
    if d["ua_firmware"]:
        units.set_firmware_detected(conn, units.SYSTEM_INTAKE, d["unit_id"], d["ua_firmware"], src)


def get(conn, device_id):
    d = one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))
    if not d:
        raise BenchError("No such device.")
    return d


def by_code(conn, code):
    return one(conn, "SELECT * FROM devices WHERE code = ?", ((code or "").strip().upper(),))


def pending(conn):
    """Unattached, not-ignored devices: console makers first, newest first."""
    return all_(conn, "SELECT * FROM devices WHERE unit_id IS NULL AND ignored = 0"
                      " ORDER BY (vendor_group IS NULL AND ua_family IS NULL), last_seen DESC")


def everything(conn, limit=300):
    return all_(conn, "SELECT * FROM devices ORDER BY last_seen DESC LIMIT ?", (limit,))


def for_unit(conn, unit_id):
    return all_(conn, "SELECT * FROM devices WHERE unit_id = ? ORDER BY last_seen DESC", (unit_id,))


def attach(conn, actor, device_id, unit_id=None):
    """Attach a device to a unit, or open a new unit from it. Pre-fills the
    unit from what the device revealed and learns its DHCP fingerprint."""
    with tx(conn):
        d = get(conn, device_id)
        if d["unit_id"]:
            raise BenchError(f"Device {d['code']} is already attached to a unit.")
        if unit_id is None:
            unit = units.create(conn, actor, family=d["family_hint"])
            unit_id = unit["id"]
        unit = units.get(conn, unit_id)
        units._require_editable(unit)
        conn.execute("UPDATE devices SET unit_id = ? WHERE id = ?", (unit_id, device_id))
        units.log_event(conn, unit_id, actor, "device_attached", {
            "device_code": d["code"], "mac": d["mac"], "vendor": d["vendor_org"], "hostname": d["hostname"],
            "dhcp_fingerprint": d["dhcp_fingerprint"], "dhcp_vendor_class": d["dhcp_vendor_class"],
            "user_agent": d["user_agent"], "family_hint": d["family_hint"],
        })
        if d["mac"] and not unit["mac_address"]:
            units._update(conn, unit, actor, {"mac_address": d["mac"]})
        d = get(conn, device_id)
        if d["family_hint"] or d["ua_firmware"]:
            _prefill_unit(conn, d)
        learn(conn, unit_id)
        return units.get(conn, unit_id)


def learn(conn, unit_id):
    """Remember fingerprint -> family for devices on this unit, once the
    family is known. Learned from what techs confirm, never shipped guesses."""
    unit = units.get(conn, unit_id)
    if not unit["console_family"]:
        return
    for d in for_unit(conn, unit_id):
        key = fingerprint_key(d["dhcp_fingerprint"], d["dhcp_vendor_class"])
        if key:
            conn.execute("INSERT INTO fingerprint_hints (fingerprint, console_family, learned_at, learned_from_unit)"
                         " VALUES (?, ?, ?, ?) ON CONFLICT(fingerprint) DO UPDATE SET console_family = excluded.console_family,"
                         " learned_at = excluded.learned_at, learned_from_unit = excluded.learned_from_unit",
                         (key, unit["console_family"], now(), unit_id))


def set_ignored(conn, device_id, ignored=True):
    with tx(conn):
        get(conn, device_id)
        conn.execute("UPDATE devices SET ignored = ? WHERE id = ?", (int(ignored), device_id))


def family_label(key):
    fam = families.get(key)
    return fam.name if fam else None

"""Unit records: create, edit, and the per-unit provenance records.

Every mutation goes through here, runs in one transaction, and appends to
unit_events in that same transaction -- a change and its audit row commit
together or not at all.
"""

import json
from dataclasses import dataclass

from . import families
from .db import all_, now, one, tx
from .ident import normalize_mac

EDITABLE = ("received", "tested", "refurbished")


class BenchError(Exception):
    """A refusal with a message meant for the tech."""


class Locked(BenchError):
    pass


@dataclass(frozen=True)
class Actor:
    name: str
    tech_id: int | None = None


SYSTEM_WATCHER = Actor("system:network-watcher")
SYSTEM_INTAKE = Actor("system:intake-page")
SYSTEM_SCANNER = Actor("system:scanner")


# --- techs -----------------------------------------------------------------

def list_techs(conn):
    return all_(conn, "SELECT * FROM techs ORDER BY name")


def add_tech(conn, name):
    name = " ".join((name or "").split())[:60]
    if not name:
        raise BenchError("Name can't be blank.")
    with tx(conn):
        existing = one(conn, "SELECT * FROM techs WHERE name = ?", (name,))
        if existing:
            return existing
        cur = conn.execute("INSERT INTO techs (name, created_at) VALUES (?, ?)", (name, now()))
        return one(conn, "SELECT * FROM techs WHERE id = ?", (cur.lastrowid,))


def actor_for(conn, tech_id):
    row = one(conn, "SELECT * FROM techs WHERE id = ?", (tech_id,)) if tech_id else None
    return Actor(row["name"], row["id"]) if row else None


# --- events ----------------------------------------------------------------

def log_event(conn, unit_id, actor, kind, detail=None, from_status=None, to_status=None):
    conn.execute(
        "INSERT INTO unit_events (unit_id, at, actor, actor_tech_id, kind, from_status, to_status, detail)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (unit_id, now(), actor.name, actor.tech_id, kind, from_status, to_status,
         json.dumps(detail or {}, ensure_ascii=False, sort_keys=True)),
    )


def events(conn, unit_id):
    return all_(conn, "SELECT * FROM unit_events WHERE unit_id = ? ORDER BY id DESC", (unit_id,))


# --- reads -----------------------------------------------------------------

def get(conn, unit_id):
    row = one(conn, "SELECT * FROM units WHERE id = ?", (unit_id,))
    if not row:
        raise BenchError(f"No unit #{unit_id}.")
    return row


def code(unit):
    return unit["intake_barcode"] or f"U{unit['id']:05d}"


def by_barcode(conn, barcode):
    return one(conn, "SELECT * FROM units WHERE intake_barcode = ?", (barcode,))


def listing(conn, status=None, q=None, limit=200):
    sql, params = "SELECT * FROM units WHERE 1=1", []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if q:
        sql += " AND (intake_barcode LIKE ? OR serial_no LIKE ? OR model_revision LIKE ? OR listing_id LIKE ?)"
        params += [f"%{q}%"] * 4
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    return all_(conn, sql, params)


def repairs(conn, unit_id):
    return all_(conn, "SELECT r.*, t.name AS by_name FROM repairs r JOIN techs t ON t.id = r.done_by"
                      " WHERE unit_id = ? ORDER BY r.id", (unit_id,))


def attachments(conn, unit_id):
    return all_(conn, "SELECT * FROM attachments WHERE unit_id = ? ORDER BY id", (unit_id,))


def photo_set(conn, unit_id):
    """Latest photo per slot -> {slot: row}."""
    out = {}
    for a in attachments(conn, unit_id):
        if a["slot"] and a["kind"] == "photo":
            out[a["slot"]] = a
    return out


def tech_name(conn, tech_id):
    row = one(conn, "SELECT name FROM techs WHERE id = ?", (tech_id,)) if tech_id else None
    return row["name"] if row else None


# --- writes ----------------------------------------------------------------

def _require_editable(unit):
    if unit["status"] not in EDITABLE:
        hint = " Pull it back to refurbished first." if unit["status"] == "listable" else ""
        raise Locked(f"{code(unit)} is {unit['status']}; its record is locked.{hint}")


def _update(conn, unit, actor, changes, kind="updated", extra=None):
    """Apply changed fields only; log old -> new. Returns the fresh row."""
    diff = {k: v for k, v in changes.items() if unit[k] != v}
    if diff:
        sets = ", ".join(f"{k} = ?" for k in diff)
        conn.execute(f"UPDATE units SET {sets} WHERE id = ?", (*diff.values(), unit["id"]))
        detail = {"changes": {k: [unit[k], v] for k, v in diff.items()}}
        detail.update(extra or {})
        log_event(conn, unit["id"], actor, kind, detail)
    return get(conn, unit["id"])


def _clean(text, limit=200):
    text = " ".join((text or "").split())
    return text[:limit] or None


def _clean_barcode(barcode):
    barcode = (barcode or "").strip()
    if not barcode:
        return None
    if len(barcode) > 64 or not barcode.isprintable():
        raise BenchError("That doesn't look like a barcode (too long or unprintable).")
    return barcode


def create(conn, actor, barcode=None, family=None):
    barcode = _clean_barcode(barcode)
    if family and not families.get(family):
        raise BenchError(f"Unknown console family {family!r}.")
    with tx(conn):
        if barcode and by_barcode(conn, barcode):
            raise BenchError(f"Barcode {barcode} is already on a unit.")
        fam = families.get(family)
        cur = conn.execute(
            "INSERT INTO units (intake_barcode, received_at, console_family, has_writable_storage)"
            " VALUES (?, ?, ?, ?)",
            (barcode, now(), family, int(bool(fam and fam.writable_storage))),
        )
        unit_id = cur.lastrowid
        log_event(conn, unit_id, actor, "created",
                  {"intake_barcode": barcode, "console_family": family}, to_status="received")
        return get(conn, unit_id)


def scan(conn, actor, barcode):
    """Barcode intake: open the unit if we know the barcode, else create it.
    -> (unit, created)"""
    barcode = _clean_barcode(barcode)
    if not barcode:
        raise BenchError("Scan or type a barcode.")
    existing = by_barcode(conn, barcode)
    if existing:
        with tx(conn):
            log_event(conn, existing["id"], actor, "scanned", {"intake_barcode": barcode})
        return existing, False
    return create(conn, actor, barcode=barcode), True


IDENTITY_FIELDS = ("intake_barcode", "console_family", "model_revision", "serial_no",
                   "mac_address", "has_writable_storage", "notes")


def update_identity(conn, actor, unit_id, **fields):
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        changes = {}
        for key, value in fields.items():
            if key not in IDENTITY_FIELDS:
                raise BenchError(f"Can't edit {key} here.")
            if key == "intake_barcode":
                value = _clean_barcode(value)
                if value and value != unit["intake_barcode"]:
                    other = by_barcode(conn, value)
                    if other:
                        raise BenchError(f"Barcode {value} is already on {code(other)}.")
            elif key == "console_family":
                value = value or None
                if value and not families.get(value):
                    raise BenchError(f"Unknown console family {value!r}.")
                if value != unit["console_family"] and "has_writable_storage" not in fields:
                    fam = families.get(value)
                    changes["has_writable_storage"] = int(bool(fam and fam.writable_storage))
            elif key == "has_writable_storage":
                value = int(bool(value))
            elif key == "mac_address":
                value = normalize_mac(value) if value else None
            elif key == "notes":
                value = (value or "").strip()[:4000] or None
            else:
                value = _clean(value, 120)
            changes[key] = value
        return _update(conn, unit, actor, changes)


def set_firmware_entered(conn, actor, unit_id, version):
    """Tech typed (or confirmed) the firmware. Typing it is confirming it."""
    version = _clean(version, 40)
    if not version:
        raise BenchError("Enter the firmware version shown on the console.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "firmware_version": version,
            "firmware_source": "entered" if version != unit["firmware_version"] else unit["firmware_source"] or "entered",
            "firmware_confirmed_by": actor.tech_id,
            "firmware_confirmed_at": now(),
        }, kind="firmware_confirmed")


def set_firmware_detected(conn, actor, unit_id, version, source_detail):
    """Pre-fill from the console's UA. Never overwrites a confirmed value."""
    with tx(conn):
        unit = get(conn, unit_id)
        if unit["status"] not in EDITABLE or unit["firmware_confirmed_by"] or not version:
            return unit
        return _update(conn, unit, actor, {"firmware_version": version, "firmware_source": "detected"},
                       kind="firmware_detected", extra=source_detail)


def prefill_family(conn, actor, unit_id, family, source_detail):
    """Advisory family pre-fill; only fills a blank."""
    with tx(conn):
        unit = get(conn, unit_id)
        if unit["status"] not in EDITABLE or unit["console_family"] or not families.get(family):
            return unit
        fam = families.get(family)
        return _update(conn, unit, actor, {"console_family": family,
                                           "has_writable_storage": int(fam.writable_storage)},
                       kind="family_detected", extra=source_detail)


def set_grade(conn, actor, unit_id, grade, notes):
    if grade not in ("A", "B", "C"):
        raise BenchError("Grade is A, B or C.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {"cosmetic_grade": grade,
                                           "cosmetic_notes": (notes or "").strip()[:1000] or None})


def add_repair(conn, actor, unit_id, kind, description):
    if kind not in families.REPAIR_KINDS:
        raise BenchError("Pick a repair type.")
    description = (description or "").strip()[:500]
    if kind == "other" and not description:
        raise BenchError("Describe the work for 'Other'.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        cur = conn.execute("INSERT INTO repairs (unit_id, kind, description, done_by, done_at) VALUES (?, ?, ?, ?, ?)",
                           (unit_id, kind, description, actor.tech_id, now()))
        log_event(conn, unit_id, actor, "repair", {"repair_id": cur.lastrowid, "kind": kind,
                                                    "description": description})
        return get(conn, unit_id)


def record_mod(conn, actor, unit_id, mod_type, method_ref, mod_firmware):
    """Record a mod the tech performed by hand. The appliance does not perform,
    serve, or store anything used to do it -- this is a provenance record."""
    mod_type = _clean(mod_type, 120)
    method_ref = _clean(method_ref, 200)
    if not mod_type or not method_ref:
        raise BenchError("Mod type and the SOP reference are both required.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "mod_performed": 1, "mod_type": mod_type, "mod_method_ref": method_ref,
            "mod_firmware": _clean(mod_firmware, 40) or unit["firmware_version"],
            "mod_by": actor.tech_id, "mod_at": now(),
        }, kind="mod_recorded")


def clear_mod(conn, actor, unit_id, reason):
    reason = _clean(reason, 300)
    if not reason:
        raise BenchError("Say why the mod record is being removed.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "mod_performed": 0, "mod_type": None, "mod_method_ref": None, "mod_firmware": None,
            "mod_by": None, "mod_at": None,
        }, kind="mod_cleared", extra={"reason": reason})


def record_wipe(conn, actor, unit_id, method):
    method = _clean(method, 200)
    if not method:
        raise BenchError("Say how the storage was wiped.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "storage_wiped": 1, "storage_wipe_method": method,
            "storage_wiped_by": actor.tech_id, "storage_wiped_at": now(),
        }, kind="storage_wiped")


def attest_no_games(conn, actor, unit_id):
    """The no-preloaded-games attestation, by a named tech, timestamped."""
    if actor.tech_id is None:
        raise BenchError("Only a named tech can attest.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "no_preloaded_games": 1, "no_preloaded_games_by": actor.tech_id,
            "no_preloaded_games_at": now(),
        }, kind="attested_no_preloaded_games")


def withdraw_attestation(conn, actor, unit_id, reason):
    reason = _clean(reason, 300)
    if not reason:
        raise BenchError("Say why the attestation is being withdrawn.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        return _update(conn, unit, actor, {
            "no_preloaded_games": 0, "no_preloaded_games_by": None, "no_preloaded_games_at": None,
        }, kind="attestation_withdrawn", extra={"reason": reason})


def add_attachment(conn, actor, unit_id, meta, slot=None, qc_result_id=None):
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        cur = conn.execute(
            "INSERT INTO attachments (unit_id, qc_result_id, slot, kind, media_type, stored_name,"
            " original_name, size_bytes, sha256, uploaded_by, uploaded_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (unit_id, qc_result_id, slot, meta["kind"], meta["media_type"], meta["stored_name"],
             meta["original_name"], meta["size_bytes"], meta["sha256"], actor.tech_id, now()),
        )
        log_event(conn, unit_id, actor, "attachment", {
            "attachment_id": cur.lastrowid, "kind": meta["kind"], "slot": slot,
            "qc_result_id": qc_result_id, "sha256": meta["sha256"], "size_bytes": meta["size_bytes"],
        })
        return one(conn, "SELECT * FROM attachments WHERE id = ?", (cur.lastrowid,))

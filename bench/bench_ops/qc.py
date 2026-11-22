"""Guided QC: templates (seeded, editable), runs (snapshotted), results."""

from . import families
from .db import all_, now, one, tx
from .units import BenchError, _require_editable, get, log_event

RESULTS = ("pass", "fail", "na")


# --- templates -------------------------------------------------------------

def seed_templates(conn):
    """Create a template for every family that doesn't have one. Never touches
    a template that exists, so tech edits survive restarts and upgrades."""
    created = []
    with tx(conn):
        for fam in families.FAMILIES.values():
            if one(conn, "SELECT 1 FROM qc_templates WHERE console_family = ?", (fam.key,)):
                continue
            cur = conn.execute("INSERT INTO qc_templates (console_family, name, updated_at) VALUES (?, ?, ?)",
                               (fam.key, f"{fam.name} QC", now()))
            pos = 0
            for section, items in fam.checks.items():
                for label, guidance, blocking in items:
                    pos += 10
                    conn.execute(
                        "INSERT INTO qc_template_items (template_id, position, section, label, guidance, blocking)"
                        " VALUES (?, ?, ?, ?, ?, ?)", (cur.lastrowid, pos, section, label, guidance, int(blocking)))
            for label, guidance, blocking, slot in families.COSMETIC_ITEMS:
                pos += 10
                conn.execute(
                    "INSERT INTO qc_template_items (template_id, position, section, label, guidance, blocking, photo_slot)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (cur.lastrowid, pos, families.COSMETIC_SECTION, label, guidance, int(blocking), slot))
            created.append(fam.key)
    return created


def templates(conn):
    return all_(conn, "SELECT t.*, (SELECT COUNT(*) FROM qc_template_items i WHERE i.template_id = t.id) AS n"
                      " FROM qc_templates t ORDER BY t.id")


def template(conn, template_id):
    row = one(conn, "SELECT * FROM qc_templates WHERE id = ?", (template_id,))
    if not row:
        raise BenchError("No such template.")
    return row


def template_items(conn, template_id):
    return all_(conn, "SELECT * FROM qc_template_items WHERE template_id = ? ORDER BY position, id", (template_id,))


def _item_fields(section, label, guidance, blocking, photo_slot):
    section, label = " ".join((section or "").split()), " ".join((label or "").split())
    if not section or not label:
        raise BenchError("Section and label are required.")
    if photo_slot and photo_slot not in families.PHOTO_SLOTS:
        raise BenchError("Unknown photo slot.")
    return section[:80], label[:200], (guidance or "").strip()[:1000], int(bool(blocking)), photo_slot or None


def add_template_item(conn, template_id, section, label, guidance="", blocking=True, photo_slot=None, position=None):
    fields = _item_fields(section, label, guidance, blocking, photo_slot)
    with tx(conn):
        template(conn, template_id)
        if position is None:
            position = (one(conn, "SELECT COALESCE(MAX(position), 0) FROM qc_template_items WHERE template_id = ?",
                            (template_id,))[0]) + 10
        conn.execute("INSERT INTO qc_template_items (template_id, position, section, label, guidance, blocking, photo_slot)"
                     " VALUES (?, ?, ?, ?, ?, ?, ?)", (template_id, int(position), *fields))
        conn.execute("UPDATE qc_templates SET updated_at = ? WHERE id = ?", (now(), template_id))


def update_template_item(conn, item_id, section, label, guidance, blocking, photo_slot, position):
    fields = _item_fields(section, label, guidance, blocking, photo_slot)
    with tx(conn):
        item = one(conn, "SELECT * FROM qc_template_items WHERE id = ?", (item_id,))
        if not item:
            raise BenchError("No such item.")
        conn.execute("UPDATE qc_template_items SET section = ?, label = ?, guidance = ?, blocking = ?, photo_slot = ?,"
                     " position = ? WHERE id = ?", (*fields, int(position), item_id))
        conn.execute("UPDATE qc_templates SET updated_at = ? WHERE id = ?", (now(), item["template_id"]))
        return item["template_id"]


def delete_template_item(conn, item_id):
    # Safe: runs hold their own copy of every item.
    with tx(conn):
        item = one(conn, "SELECT * FROM qc_template_items WHERE id = ?", (item_id,))
        if not item:
            raise BenchError("No such item.")
        conn.execute("DELETE FROM qc_template_items WHERE id = ?", (item_id,))
        conn.execute("UPDATE qc_templates SET updated_at = ? WHERE id = ?", (now(), item["template_id"]))
        return item["template_id"]


# --- runs ------------------------------------------------------------------

def start_run(conn, actor, unit_id):
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        if not unit["console_family"]:
            raise BenchError("Set the console family first -- the checklist depends on it.")
        tpl = one(conn, "SELECT * FROM qc_templates WHERE console_family = ?", (unit["console_family"],))
        if not tpl:
            raise BenchError(f"No QC template for {unit['console_family']}.")
        items = template_items(conn, tpl["id"])
        if not items:
            raise BenchError("That template has no items.")
        cur = conn.execute("INSERT INTO qc_runs (unit_id, template_id, console_family, started_at, started_by)"
                           " VALUES (?, ?, ?, ?, ?)", (unit_id, tpl["id"], unit["console_family"], now(), actor.tech_id))
        run_id = cur.lastrowid
        for it in items:
            conn.execute("INSERT INTO qc_results (run_id, position, section, label, guidance, blocking, photo_slot)"
                         " VALUES (?, ?, ?, ?, ?, ?, ?)",
                         (run_id, it["position"], it["section"], it["label"], it["guidance"], it["blocking"], it["photo_slot"]))
        log_event(conn, unit_id, actor, "qc_started", {"run_id": run_id, "template_id": tpl["id"], "items": len(items)})
        return run_id


def runs(conn, unit_id):
    return all_(conn, "SELECT * FROM qc_runs WHERE unit_id = ? ORDER BY id DESC", (unit_id,))


def run(conn, unit_id, run_id):
    row = one(conn, "SELECT * FROM qc_runs WHERE id = ? AND unit_id = ?", (run_id, unit_id))
    if not row:
        raise BenchError("No such QC run on this unit.")
    return row


def results(conn, run_id):
    return all_(conn, "SELECT * FROM qc_results WHERE run_id = ? ORDER BY position, id", (run_id,))


def summary(conn, run_id):
    rows = results(conn, run_id)
    return {
        "total": len(rows),
        "answered": sum(1 for r in rows if r["result"]),
        "pass": sum(1 for r in rows if r["result"] == "pass"),
        "fail": sum(1 for r in rows if r["result"] == "fail"),
        "na": sum(1 for r in rows if r["result"] == "na"),
        "blocking_fails": [r for r in rows if r["result"] == "fail" and r["blocking"]],
        "advisory_fails": [r for r in rows if r["result"] == "fail" and not r["blocking"]],
        "open": [r for r in rows if not r["result"]],
    }


def record_result(conn, actor, unit_id, run_id, result_id, result, note=None):
    if result not in RESULTS:
        raise BenchError("Result is pass, fail or N/A.")
    note = (note or "").strip()[:1000] or None
    if result == "fail" and not note:
        raise BenchError("Add a note saying what failed.")
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        r = run(conn, unit_id, run_id)
        if r["completed_at"]:
            raise BenchError("That QC run is complete and locked. Start a new run to re-test.")
        row = one(conn, "SELECT * FROM qc_results WHERE id = ? AND run_id = ?", (result_id, run_id))
        if not row:
            raise BenchError("No such checklist item.")
        conn.execute("UPDATE qc_results SET result = ?, note = ?, recorded_by = ?, recorded_at = ? WHERE id = ?",
                     (result, note, actor.tech_id, now(), result_id))
        log_event(conn, unit_id, actor, "qc_result", {
            "run_id": run_id, "result_id": result_id, "label": row["label"], "blocking": row["blocking"],
            "result": result, "previous": row["result"], "note": note,
        })


def complete_run(conn, actor, unit_id, run_id):
    with tx(conn):
        unit = get(conn, unit_id)
        _require_editable(unit)
        r = run(conn, unit_id, run_id)
        if r["completed_at"]:
            raise BenchError("Already complete.")
        s = summary(conn, run_id)
        if s["open"]:
            raise BenchError(f"{len(s['open'])} item(s) still open, starting with: {s['open'][0]['label']}")
        conn.execute("UPDATE qc_runs SET completed_at = ?, completed_by = ? WHERE id = ?", (now(), actor.tech_id, run_id))
        log_event(conn, unit_id, actor, "qc_completed", {
            "run_id": run_id, "pass": s["pass"], "fail": s["fail"], "na": s["na"],
            "blocking_fails": [x["label"] for x in s["blocking_fails"]],
        })


def latest_complete_run(conn, unit_id):
    return one(conn, "SELECT * FROM qc_runs WHERE unit_id = ? AND completed_at IS NOT NULL"
                     " ORDER BY completed_at DESC, id DESC LIMIT 1", (unit_id,))


def open_run(conn, unit_id):
    return one(conn, "SELECT * FROM qc_runs WHERE unit_id = ? AND completed_at IS NULL ORDER BY id DESC LIMIT 1",
               (unit_id,))


def autopass_photo_item(conn, actor, unit_id, slot):
    """A photo landed in a slot: pass that slot's item on the open run, if
    it's still unanswered. The tech can still change it."""
    r = open_run(conn, unit_id)
    if not r:
        return
    row = one(conn, "SELECT * FROM qc_results WHERE run_id = ? AND photo_slot = ? AND result IS NULL", (r["id"], slot))
    if row:
        record_result(conn, actor, unit_id, r["id"], row["id"], "pass", None)

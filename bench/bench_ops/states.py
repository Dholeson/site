"""The status state machine and its gates.

    received -> tested -> refurbished -> listable -> listed -> sold
         \\________\\___________\\____________\\__________\\--> failed (reason)

Plus two guarded ways back, each needing a reason and logged:
    failed   -> received     (reopen a unit that was failed)
    listable -> refurbished  (pull a unit back to change its record)

Gate order matters for provenance, so the gates compare timestamps:
  * the QC run that clears `refurbished` must post-date the last repair/mod
    ("QC re-passed", not "passed once, then someone opened it up");
  * the wipe must post-date the mod (wiping is the last thing to touch storage);
  * the attestation must post-date both.
The DB repeats the two compliance gates as CHECK constraints (0001_init.sql).
"""

from . import qc
from .db import one, tx
from .units import BenchError, code, get, log_event

TRANSITIONS = {
    "received": ("tested", "failed"),
    "tested": ("refurbished", "failed"),
    "refurbished": ("listable", "failed"),
    "listable": ("listed", "refurbished", "failed"),
    "listed": ("sold", "failed"),
    "sold": (),
    "failed": ("received",),
}

STATUSES = tuple(TRANSITIONS)

NEEDS_REASON = {("failed", "received"), ("listable", "refurbished")}


class GateFailed(BenchError):
    def __init__(self, unit, to, problems):
        self.problems = problems
        super().__init__(f"{code(unit)} can't move to {to}: " + "; ".join(problems))


def _last_work_at(conn, unit):
    last_repair = one(conn, "SELECT MAX(done_at) FROM repairs WHERE unit_id = ?", (unit["id"],))[0]
    return max(filter(None, [last_repair, unit["mod_at"]]), default=None)


def _tested_problems(conn, unit):
    if not unit["console_family"]:
        return ["console family not set"], None
    run = qc.latest_complete_run(conn, unit["id"])
    if not run:
        return ["no completed QC sheet"], None
    if run["console_family"] != unit["console_family"]:
        return [f"latest QC sheet was for {run['console_family']}, unit is now {unit['console_family']} -- re-run QC"], None
    return [], run


def _refurbished_problems(conn, unit):
    problems, run = _tested_problems(conn, unit)
    if run:
        s = qc.summary(conn, run["id"])
        if s["blocking_fails"]:
            problems.append("open blocking QC fail(s): " + ", ".join(r["label"] for r in s["blocking_fails"]))
        last_work = _last_work_at(conn, unit)
        if last_work and run["completed_at"] < last_work:
            problems.append("repairs/mod recorded after the last QC sheet -- re-run QC")
    if unit["has_writable_storage"]:
        if not unit["storage_wiped"]:
            problems.append("storage not wiped")
        elif unit["mod_at"] and unit["storage_wiped_at"] < unit["mod_at"]:
            problems.append("storage wipe predates the mod -- wipe again after modding")
    return problems


def _listable_problems(conn, unit):
    problems = _refurbished_problems(conn, unit)
    if not unit["no_preloaded_games"]:
        problems.append("no-preloaded-games attestation missing")
    else:
        at = unit["no_preloaded_games_at"]
        if unit["mod_at"] and at < unit["mod_at"]:
            problems.append("attestation predates the mod -- re-attest")
        if unit["has_writable_storage"] and unit["storage_wiped_at"] and at < unit["storage_wiped_at"]:
            problems.append("attestation predates the storage wipe -- re-attest")
    if not unit["cosmetic_grade"]:
        problems.append("cosmetic grade not set")
    return problems


def problems_for(conn, unit, to, reason=None, sale_ref=None, listing_id=None):
    """Everything standing between this unit and `to`. Empty list = allowed."""
    frm = unit["status"]
    if to not in TRANSITIONS.get(frm, ()):
        return [f"{frm} -> {to} isn't a transition"]
    if to == "failed" or (frm, to) in NEEDS_REASON:
        return [] if (reason or "").strip() else ["a reason is required"]
    if to == "tested":
        return _tested_problems(conn, unit)[0]
    if to == "refurbished":
        return _refurbished_problems(conn, unit)
    if to == "listable":
        return _listable_problems(conn, unit)
    if to == "listed":
        problems = _listable_problems(conn, unit)
        if not listing_id:
            problems.append("export the listing (that's what moves a unit to listed)")
        return problems
    if to == "sold":
        return [] if (sale_ref or "").strip() else ["a sale reference is required"]
    return []


def next_steps(conn, unit):
    """[(to, problems)] for every transition out of the unit's state -- the
    UI shows what's blocking each one."""
    return [(to, problems_for(conn, unit, to, reason="x", sale_ref="x", listing_id="x"))
            for to in TRANSITIONS[unit["status"]]]


def transition(conn, actor, unit_id, to, reason=None, sale_ref=None, listing_id=None):
    with tx(conn):
        unit = get(conn, unit_id)
        problems = problems_for(conn, unit, to, reason=reason, sale_ref=sale_ref, listing_id=listing_id)
        if problems:
            raise GateFailed(unit, to, problems)
        frm = unit["status"]
        sets = {"status": to}
        if to == "failed":
            sets["failed_reason"] = reason.strip()[:500]
        if frm == "failed":
            sets["failed_reason"] = None
        if to == "listed":
            sets["listing_id"] = listing_id
        if to == "sold":
            sets["sale_ref"] = sale_ref.strip()[:200]
        conn.execute(f"UPDATE units SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?",
                     (*sets.values(), unit_id))
        detail = {k: v for k, v in {"reason": (reason or "").strip() or None, "sale_ref": sale_ref,
                                    "listing_id": listing_id}.items() if v}
        log_event(conn, unit_id, actor, "transition", detail, from_status=frm, to_status=to)
        return get(conn, unit_id)

import pytest

from bench_ops import listing, qc, states, units
from bench_ops.states import GateFailed
from bench_ops.units import BenchError, Locked

from .conftest import pass_qc, to_listable


def blocked(conn, unit_id, to, **kw):
    return states.problems_for(conn, units.get(conn, unit_id), to, **kw)


def test_full_lifecycle_logs_every_transition(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    listing.save_draft(conn, tech, u["id"], "PlayStation 3 Console", 18500, "refurbished", "Blurb.", "Line")
    listing.export(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "sold", sale_ref="cs_test_123")
    u = units.get(conn, u["id"])
    assert u["status"] == "sold" and u["sale_ref"] == "cs_test_123" and u["listing_id"]
    path = [(e["from_status"], e["to_status"]) for e in reversed(units.events(conn, u["id"])) if e["to_status"]]
    assert path == [(None, "received"), ("received", "tested"), ("tested", "refurbished"),
                    ("refurbished", "listable"), ("listable", "listed"), ("listed", "sold")]


def test_tested_needs_a_complete_qc_sheet(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    assert "no completed QC sheet" in blocked(conn, u["id"], "tested")
    run_id = qc.start_run(conn, tech, u["id"])
    with pytest.raises(BenchError, match="still open"):
        qc.complete_run(conn, tech, u["id"], run_id)
    assert "no completed QC sheet" in blocked(conn, u["id"], "tested")


def test_tested_allows_fails_but_refurbished_does_not(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    pass_qc(conn, tech, u["id"], fail={"Controller port 3 reads input"})
    states.transition(conn, tech, u["id"], "tested")
    probs = blocked(conn, u["id"], "refurbished")
    assert any("Controller port 3" in p for p in probs)
    with pytest.raises(GateFailed):
        states.transition(conn, tech, u["id"], "refurbished")


def test_advisory_fail_does_not_block(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    pass_qc(conn, tech, u["id"], fail={"Component via Digital AV Out (models with the digital port, if cable on hand)"})
    states.transition(conn, tech, u["id"], "tested")
    assert blocked(conn, u["id"], "refurbished") == []  # GameCube: no writable storage


def test_repair_after_qc_requires_a_retest(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    pass_qc(conn, tech, u["id"], fail={"Disc drive reads a known-good disc"})
    states.transition(conn, tech, u["id"], "tested")
    units.add_repair(conn, tech, u["id"], "laser_replaced", "")
    probs = blocked(conn, u["id"], "refurbished")
    assert any("Disc drive" in p for p in probs)
    assert any("re-run QC" in p for p in probs)
    pass_qc(conn, tech, u["id"])  # the re-test
    assert blocked(conn, u["id"], "refurbished") == []


def test_writable_storage_must_be_wiped(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps4")
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    assert "storage not wiped" in blocked(conn, u["id"], "refurbished")
    units.record_wipe(conn, tech, u["id"], "Full HDD format")
    assert blocked(conn, u["id"], "refurbished") == []


def test_no_wipe_needed_without_writable_storage(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps1")
    assert u["has_writable_storage"] == 0
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    states.transition(conn, tech, u["id"], "refurbished")


def test_wipe_must_postdate_mod(conn, tech):
    u = units.create(conn, tech, barcode="X", family="wii")
    units.record_wipe(conn, tech, u["id"], "System memory format")
    units.record_mod(conn, tech, u["id"], "homebrew enabled", "SOP-WII-01 v3", "4.3U")
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    assert any("wipe predates the mod" in p for p in blocked(conn, u["id"], "refurbished"))
    units.record_wipe(conn, tech, u["id"], "System memory format")
    assert blocked(conn, u["id"], "refurbished") == []


def test_listable_is_gated_on_the_attestation(conn, tech, media_dir):
    u = units.create(conn, tech, barcode="X", family="ps3")
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    units.record_wipe(conn, tech, u["id"], "Full HDD format")
    states.transition(conn, tech, u["id"], "refurbished")
    units.set_grade(conn, tech, u["id"], "B", "")
    assert blocked(conn, u["id"], "listable") == ["no-preloaded-games attestation missing"]
    with pytest.raises(GateFailed, match="attestation"):
        states.transition(conn, tech, u["id"], "listable")
    units.attest_no_games(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "listable")


def test_attestation_must_postdate_wipe_and_mod(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps3")
    units.attest_no_games(conn, tech, u["id"])
    units.record_mod(conn, tech, u["id"], "homebrew enabled", "SOP-PS3-02", None)
    units.record_wipe(conn, tech, u["id"], "Full HDD format")
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    states.transition(conn, tech, u["id"], "refurbished")
    units.set_grade(conn, tech, u["id"], "A", "")
    probs = blocked(conn, u["id"], "listable")
    assert "attestation predates the mod -- re-attest" in probs
    assert "attestation predates the storage wipe -- re-attest" in probs
    units.attest_no_games(conn, tech, u["id"])
    assert blocked(conn, u["id"], "listable") == []


def test_only_a_named_tech_can_attest(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps3")
    with pytest.raises(BenchError, match="named tech"):
        units.attest_no_games(conn, units.SYSTEM_INTAKE, u["id"])


def test_listable_needs_a_grade(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    pass_qc(conn, tech, u["id"])
    states.transition(conn, tech, u["id"], "tested")
    states.transition(conn, tech, u["id"], "refurbished")
    units.attest_no_games(conn, tech, u["id"])
    assert blocked(conn, u["id"], "listable") == ["cosmetic grade not set"]


def test_family_change_invalidates_old_qc(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps3")
    pass_qc(conn, tech, u["id"])
    units.update_identity(conn, tech, u["id"], console_family="ps4")
    assert any("re-run QC" in p for p in blocked(conn, u["id"], "tested"))


def test_record_locks_at_listable_and_pull_back_unlocks(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    with pytest.raises(Locked):
        units.record_mod(conn, tech, u["id"], "x", "y", None)
    with pytest.raises(GateFailed, match="reason"):
        states.transition(conn, tech, u["id"], "refurbished")
    states.transition(conn, tech, u["id"], "refurbished", reason="regrade")
    units.set_grade(conn, tech, u["id"], "B", "Regraded")
    states.transition(conn, tech, u["id"], "listable")


def test_listed_only_through_export(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    with pytest.raises(GateFailed, match="export"):
        states.transition(conn, tech, u["id"], "listed")


def test_sold_needs_a_sale_ref(conn, tech, media_dir):
    u = to_listable(conn, tech, media_dir)
    listing.save_draft(conn, tech, u["id"], "PS3", 100, "refurbished", "b", "d")
    listing.export(conn, tech, u["id"])
    with pytest.raises(GateFailed, match="sale reference"):
        states.transition(conn, tech, u["id"], "sold", sale_ref="  ")


def test_failed_needs_a_reason_and_can_reopen(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps2")
    with pytest.raises(GateFailed, match="reason"):
        states.transition(conn, tech, u["id"], "failed")
    u = states.transition(conn, tech, u["id"], "failed", reason="Board corrosion, parts only")
    assert u["failed_reason"] == "Board corrosion, parts only"
    with pytest.raises(Locked):
        units.set_grade(conn, tech, u["id"], "C", "")
    u = states.transition(conn, tech, u["id"], "received", reason="Donor board arrived")
    assert u["status"] == "received" and u["failed_reason"] is None


def test_no_skipping_states(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    assert blocked(conn, u["id"], "listable") == ["received -> listable isn't a transition"]

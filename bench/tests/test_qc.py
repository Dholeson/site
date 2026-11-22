import pytest

from bench_ops import families, qc, units
from bench_ops.units import BenchError

from .conftest import add_photo


def test_every_family_gets_a_template_with_the_photo_set(conn):
    rows = {t["console_family"]: t for t in qc.templates(conn)}
    assert set(rows) == set(families.FAMILIES)
    for t in rows.values():
        items = qc.template_items(conn, t["id"])
        assert {i["photo_slot"] for i in items if i["photo_slot"]} == set(families.PHOTO_SLOTS)
        assert any(i["section"] == "Power" for i in items)


def test_battery_rtc_only_on_the_handheld(conn):
    for t in qc.templates(conn):
        sections = {i["section"] for i in qc.template_items(conn, t["id"])}
        assert ("Battery / RTC" in sections) == (t["console_family"] == "psp")


def test_seeding_never_touches_an_existing_template(conn):
    t = qc.templates(conn)[0]
    qc.add_template_item(conn, t["id"], "Power", "Smells fine")
    before = len(qc.template_items(conn, t["id"]))
    assert qc.seed_templates(conn) == []
    assert len(qc.template_items(conn, t["id"])) == before


def test_template_edits_do_not_rewrite_past_runs(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps2")
    run_id = qc.start_run(conn, tech, u["id"])
    labels = [r["label"] for r in qc.results(conn, run_id)]
    tpl = next(t for t in qc.templates(conn) if t["console_family"] == "ps2")
    first = qc.template_items(conn, tpl["id"])[0]
    qc.update_template_item(conn, first["id"], "Power", "Renamed", "", True, None, 1)
    qc.delete_template_item(conn, qc.template_items(conn, tpl["id"])[-1]["id"])
    assert [r["label"] for r in qc.results(conn, run_id)] == labels


def test_fail_needs_a_note(conn, tech):
    u = units.create(conn, tech, barcode="X", family="ps2")
    run_id = qc.start_run(conn, tech, u["id"])
    item = qc.results(conn, run_id)[0]
    with pytest.raises(BenchError, match="note"):
        qc.record_result(conn, tech, u["id"], run_id, item["id"], "fail", "  ")


def test_complete_run_is_locked(conn, tech):
    u = units.create(conn, tech, barcode="X", family="gc")
    run_id = qc.start_run(conn, tech, u["id"])
    for r in qc.results(conn, run_id):
        qc.record_result(conn, tech, u["id"], run_id, r["id"], "na")
    qc.complete_run(conn, tech, u["id"], run_id)
    item = qc.results(conn, run_id)[0]
    with pytest.raises(BenchError, match="locked"):
        qc.record_result(conn, tech, u["id"], run_id, item["id"], "pass")


def test_qc_needs_a_family(conn, tech):
    u = units.create(conn, tech, barcode="X")
    with pytest.raises(BenchError, match="family"):
        qc.start_run(conn, tech, u["id"])


def test_photo_upload_passes_its_slot_item(conn, tech, media_dir):
    u = units.create(conn, tech, barcode="X", family="gc")
    run_id = qc.start_run(conn, tech, u["id"])
    add_photo(conn, tech, u["id"], media_dir, "serial")
    qc.autopass_photo_item(conn, tech, u["id"], "serial")
    row = next(r for r in qc.results(conn, run_id) if r["photo_slot"] == "serial")
    assert row["result"] == "pass"

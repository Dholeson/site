import sqlite3

import pytest

from bench_ops import db, units


def test_migrations_are_idempotent(conn):
    assert db.migrate(conn) == []
    versions = [r[0] for r in conn.execute("SELECT version FROM schema_migrations")]
    assert versions == ["0001_init"]


def test_unit_events_are_append_only(conn, tech):
    u = units.create(conn, tech, barcode="X1")
    with pytest.raises(sqlite3.IntegrityError, match="append-only"):
        conn.execute("UPDATE unit_events SET actor = 'someone else' WHERE unit_id = ?", (u["id"],))
    with pytest.raises(sqlite3.IntegrityError, match="append-only"):
        conn.execute("DELETE FROM unit_events WHERE unit_id = ?", (u["id"],))


def test_units_are_never_deleted(conn, tech):
    u = units.create(conn, tech, barcode="X1")
    with pytest.raises(sqlite3.IntegrityError, match="never deleted"):
        conn.execute("DELETE FROM units WHERE id = ?", (u["id"],))


def test_db_backstops_the_attestation_gate(conn, tech):
    """Even a hand-typed UPDATE can't make a unit listable without the attestation."""
    u = units.create(conn, tech, barcode="X1", family="gc")  # no writable storage
    with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
        conn.execute("UPDATE units SET status = 'listable' WHERE id = ?", (u["id"],))


def test_db_backstops_the_wipe_gate(conn, tech):
    u = units.create(conn, tech, barcode="X1", family="ps4")
    assert u["has_writable_storage"] == 1
    with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
        conn.execute("UPDATE units SET status = 'refurbished' WHERE id = ?", (u["id"],))


def test_attestation_needs_who_and_when(conn, tech):
    u = units.create(conn, tech, barcode="X1")
    with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
        conn.execute("UPDATE units SET no_preloaded_games = 1 WHERE id = ?", (u["id"],))


def test_strict_tables_reject_fractional_cents(conn, tech):
    u = units.create(conn, tech, barcode="X1", family="gc")
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO listing_drafts (unit_id, name, price_cents, condition, blurb, details, updated_at)"
                     " VALUES (?, 'x', 145.5, 'refurbished', '', '', ?)", (u["id"], db.now()))


def test_timestamps_are_fixed_width_utc():
    t = db.now()
    assert len(t) == 24 and t.endswith("Z") and t[10] == "T"


def test_every_change_is_logged(conn, tech):
    u = units.create(conn, tech, barcode="X1", family="ps2")
    units.update_identity(conn, tech, u["id"], model_revision="SCPH-90001", serial_no="AB123")
    units.set_grade(conn, tech, u["id"], "B", "")
    kinds = [e["kind"] for e in units.events(conn, u["id"])]
    assert kinds == ["updated", "updated", "created"]
    assert all(e["actor"] == "Sam" and e["actor_tech_id"] == tech.tech_id for e in units.events(conn, u["id"]))


def test_unchanged_save_logs_nothing(conn, tech):
    u = units.create(conn, tech, barcode="X1", family="ps2")
    units.update_identity(conn, tech, u["id"], model_revision="")
    assert len(units.events(conn, u["id"])) == 1

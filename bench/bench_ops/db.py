"""SQLite access: connections, transactions, migrations, timestamps."""

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

_clock_lock = threading.Lock()
_last = None


def now():
    """UTC, millisecond precision, fixed width -- sorts as text.

    Strictly increasing within the process: the gates compare timestamps
    ("wipe after mod", "attest after wipe"), so two actions must never share
    one. The appliance is a single process, so this holds for every write.
    """
    global _last
    with _clock_lock:
        t = datetime.now(timezone.utc)
        t = t.replace(microsecond=t.microsecond // 1000 * 1000)
        if _last is not None and t <= _last:
            t = _last + timedelta(milliseconds=1)
        _last = t
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def connect(path):
    # isolation_level=None: we issue BEGIN/COMMIT ourselves (see tx()).
    # check_same_thread=False: FastAPI may open a request's connection on one
    # worker thread and use it on another; each connection is still used by
    # one request at a time.
    conn = sqlite3.connect(str(path), timeout=10, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


@contextmanager
def tx(conn):
    """One write transaction. IMMEDIATE so two writers never deadlock."""
    if conn.in_transaction:  # nested call: join the outer transaction
        yield conn
        return
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


def migrate(conn):
    """Apply migrations/NNNN_*.sql that haven't run yet, in order."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT"
    )
    done = {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
    applied = []
    for path in sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql")):
        version = path.stem
        if version in done:
            continue
        sql = path.read_text(encoding="utf-8")
        try:
            conn.executescript(
                "BEGIN;\n" + sql + "\n;INSERT INTO schema_migrations VALUES ("
                + _quote(version) + ", " + _quote(now()) + ");\nCOMMIT;"
            )
        except Exception:
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            raise
        applied.append(version)
    return applied


def _quote(s):
    return "'" + s.replace("'", "''") + "'"


def one(conn, sql, params=()):
    return conn.execute(sql, params).fetchone()


def all_(conn, sql, params=()):
    return conn.execute(sql, params).fetchall()

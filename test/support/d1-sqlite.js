// A D1Database over node:sqlite, for the store's tests.
//
// A shim, not a mock: it applies the real files in migrations/ (in the order
// `wrangler d1 migrations apply` uses) and runs every statement against a real
// SQLite engine, so the CHECK constraints, the upserts, the unique index and
// the all-or-none reservation UPDATE are genuinely exercised. D1 is SQLite
// underneath. Pattern from Dholeson/league-ify's test/d1-sqlite-shim.ts.
//
// Like D1: bind() refuses undefined, booleans become 0/1, rows come back as
// plain objects, run() returns { success, meta: { changes, last_row_id } },
// each statement is atomic, and batch() is one transaction. Each statement
// runs synchronously inside its promise, so two requests interleave only
// between statements, which is also how D1 serializes them.
//
// One D1 limit it does reproduce, because it bit once: D1 refuses a LIKE or
// GLOB pattern over 50 bytes ("LIKE or GLOB pattern too complex"), and only
// when a row is checked, not when the table is created. Every literal pattern
// in the migrations and in each prepared statement is held to that here.
//
// What it does NOT reproduce: D1's network behaviour or its other limits.
// Those need the real thing (`npx wrangler d1 migrations apply dhole-workshop
// --local`, then `npm run dev`).

import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// wrangler orders migrations by their leading number, then by name.
export function migrationFiles(dir) {
  const lead = n => parseInt(n.split("_")[0], 10);
  return readdirSync(dir).filter(n => n.endsWith(".sql")).sort((a, b) => {
    const x = lead(a), y = lead(b);
    if (x !== y && Number.isFinite(x) && Number.isFinite(y)) return x - y;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

export const D1_MAX_PATTERN_BYTES = 50;

export function checkPatterns(sql, where) {
  for (const m of sql.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)) {
    const bytes = Buffer.byteLength(m[1].replace(/''/g, "'"));
    if (bytes > D1_MAX_PATTERN_BYTES) {
      throw new Error(`D1_ERROR: LIKE or GLOB pattern too complex (${bytes} bytes, D1 allows ${D1_MAX_PATTERN_BYTES}) in ${where}: '${m[1]}'`);
    }
  }
}

function bindable(v) {
  if (v === undefined) throw new TypeError("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export function createD1(migrationsDir) {
  const db = new DatabaseSync(":memory:");
  const applied = [];
  for (const name of migrationFiles(migrationsDir)) {
    const sql = readFileSync(join(migrationsDir, name), "utf8");
    checkPatterns(sql, name);
    db.exec(sql);
    applied.push(name);
  }

  const plain = row => (row == null ? null : { ...row });

  function statement(sql, values = []) {
    const exec = () => {
      const r = db.prepare(sql).run(...values);
      return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    };
    return {
      bind(...vals) {
        return statement(sql, vals.map(bindable));
      },
      async first(column) {
        const row = plain(db.prepare(sql).get(...values));
        if (row && column) return row[column] ?? null;
        return row;
      },
      async all() {
        const results = db.prepare(sql).all(...values).map(plain);
        return { success: true, results, meta: {} };
      },
      async run() {
        return exec();
      },
      _exec: exec
    };
  }

  return {
    prepare(sql) {
      checkPatterns(sql, "a prepared statement");
      return statement(sql);
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = statements.map(s => s._exec());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    // For the tests' own setup and assertions.
    raw: db,
    applied,
    close() { db.close(); }
  };
}

"""The tech UI and the console intake page. Server-rendered, zero JavaScript.

Two audiences, kept apart:
  * Techs, on a phone/tablet on the bench LAN: everything below.
  * Consoles' own browsers: ONLY the intake page (/, /c, /console) and its
    stylesheet. ConsoleGuard refuses every other path to a console UA, so the
    appliance can't be used to hand a console anything but a plain page.

Every response carries a CSP with script-src 'none'. There are no scripts to
allow; tests/test_web.py checks every template and route stays that way.
"""

import json
import logging
import sqlite3
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware

from . import db, devices, families, ident, listing, media, netinfo, qc, states, units
from .config import Settings
from .money import PriceError, format_cents, parse_price
from .units import BenchError

log = logging.getLogger("bench.web")
HERE = Path(__file__).parent

CSP = ("default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; media-src 'self'; "
       "form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
CONSOLE_PATHS = {"/", "/c", "/console", "/static/bench.css", "/healthz"}
TECH_COOKIE = "bench_tech"


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers.setdefault("Cache-Control", "no-store")
        return response


class ConsoleGuard(BaseHTTPMiddleware):
    """A console's browser gets the intake page and nothing else."""

    async def dispatch(self, request, call_next):
        if request.method not in ("GET", "HEAD") or request.url.path not in CONSOLE_PATHS:
            if ident.parse_user_agent(request.headers.get("user-agent"))["family"]:
                return PlainTextResponse("This appliance only serves the intake page to consoles.", status_code=403)
        return await call_next(request)


def create_app(settings=None):
    settings = settings or Settings.from_env()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.media_dir.mkdir(parents=True, exist_ok=True)
    threads = {}

    def open_db():
        return db.connect(settings.db_path)

    @asynccontextmanager
    async def lifespan(app):
        conn = open_db()
        applied = db.migrate(conn)
        seeded = qc.seed_templates(conn)
        conn.close()
        if applied or seeded:
            log.info("migrations %s, seeded templates %s", applied, seeded)
        if settings.start_threads:
            _start_threads(settings, open_db, threads)
        yield
        for t in threads.values():
            t.stop()

    app = FastAPI(title="Bench Ops", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(ConsoleGuard)
    app.add_middleware(SecurityHeaders)
    app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
    templates = Jinja2Templates(directory=HERE / "templates")
    templates.env.globals.update(
        families=families, code=units.code, format_cents=format_cents, statuses=states.STATUSES,
        family_name=lambda k: (families.get(k).name if families.get(k) else "—"),
        repair_kinds=families.REPAIR_KINDS, photo_slots=families.PHOTO_SLOTS,
    )
    app.state.settings = settings
    app.state.threads = threads

    def get_conn():
        conn = open_db()
        try:
            yield conn
        finally:
            conn.close()

    def current_actor(request: Request, conn=Depends(get_conn)):
        raw = request.cookies.get(TECH_COOKIE, "")
        return units.actor_for(conn, int(raw)) if raw.isdigit() else None

    def render(request, name, status_code=200, **ctx):
        ctx.setdefault("actor", None)
        ctx["msg"] = request.query_params.get("msg")
        ctx["err"] = request.query_params.get("err")
        ctx["request_path"] = request.url.path
        return templates.TemplateResponse(request, name, ctx, status_code=status_code)

    def go(url, msg=None, err=None):
        parts = urlsplit(url)
        q = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("msg", "err")]
        if msg:
            q.append(("msg", msg))
        if err:
            q.append(("err", err))
        target = parts.path + ("?" + urlencode(q) if q else "")
        return RedirectResponse(target + (f"#{parts.fragment}" if parts.fragment else ""), status_code=303)

    def back(request, fallback="/"):
        ref = request.headers.get("referer")
        if ref:
            p = urlsplit(ref)
            if p.netloc == request.url.netloc:
                return p.path + ("?" + p.query if p.query else "")
        return fallback

    @app.exception_handler(BenchError)
    async def bench_error(request, exc):
        return go(back(request), err=str(exc))

    @app.exception_handler(sqlite3.IntegrityError)
    async def integrity_error(request, exc):
        return go(back(request), err=f"Refused by the database: {exc}")

    def need_tech(actor):
        if not actor:
            raise NeedTech()
        return actor

    class NeedTech(Exception):
        pass

    @app.exception_handler(NeedTech)
    async def need_tech_handler(request, exc):
        return go("/who?" + urlencode({"next": back(request)}), err="Pick who you are first -- every change is signed.")

    # ---- console intake ---------------------------------------------------

    def console_page(request, conn):
        ip = request.client.host if request.client else None
        mac = netinfo.mac_for_ip(ip, settings.arp_path) if ip else None
        ua = request.headers.get("user-agent", "")
        d = devices.record_intake_visit(conn, ip, mac, ua)
        unit = units.get(conn, d["unit_id"]) if d["unit_id"] else None
        return render(request, "console.html", device=d, unit=unit,
                      fam=families.get(d["family_hint"]), parsed=ident.parse_user_agent(ua))

    @app.get("/c", response_class=HTMLResponse)
    @app.get("/console", response_class=HTMLResponse)
    def console_intake(request: Request, conn=Depends(get_conn)):
        return console_page(request, conn)

    # ---- dashboard / intake -----------------------------------------------

    @app.get("/", response_class=HTMLResponse)
    def home(request: Request, conn=Depends(get_conn), actor=Depends(current_actor)):
        if ident.parse_user_agent(request.headers.get("user-agent"))["family"]:
            return console_page(request, conn)
        in_progress = db.all_(conn, "SELECT * FROM units WHERE status IN ('received','tested','refurbished','listable')"
                                    " ORDER BY id DESC LIMIT 100")
        return render(request, "home.html", actor=actor, pending=devices.pending(conn)[:20],
                      in_progress=in_progress, open_units=[u for u in in_progress if u["status"] in units.EDITABLE],
                      threads=_thread_status(threads))

    @app.post("/scan")
    def scan(request: Request, barcode: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        unit, created = units.scan(conn, actor, barcode)
        return go(f"/units/{unit['id']}", msg=("Opened a new record." if created else "Found it."))

    @app.get("/monitor", response_class=HTMLResponse)
    def monitor(request: Request, conn=Depends(get_conn)):
        recent = db.all_(conn, "SELECT e.*, u.intake_barcode FROM unit_events e JOIN units u ON u.id = e.unit_id"
                               " WHERE e.kind IN ('created','scanned','device_attached') ORDER BY e.id DESC LIMIT 10")
        return render(request, "monitor.html", recent=recent, pending=devices.pending(conn)[:10])

    # ---- who --------------------------------------------------------------

    @app.get("/who", response_class=HTMLResponse)
    def who(request: Request, conn=Depends(get_conn), actor=Depends(current_actor)):
        return render(request, "who.html", actor=actor, techs=units.list_techs(conn),
                      next=request.query_params.get("next", "/"))

    @app.post("/who")
    def who_set(tech_id: str = Form(""), new_name: str = Form(""), next: str = Form("/"), conn=Depends(get_conn)):
        if new_name.strip():
            tech = units.add_tech(conn, new_name)
        else:
            tech = db.one(conn, "SELECT * FROM techs WHERE id = ?", (int(tech_id),)) if tech_id.isdigit() else None
            if not tech:
                raise BenchError("Pick a name or add one.")
        # Same-site paths only ("//host" and "/\\host" are off-site to a browser).
        target = next if next.startswith("/") and not next.startswith("//") and "\\" not in next else "/"
        resp = go(target, msg=f"Signed in as {tech['name']}.")
        resp.set_cookie(TECH_COOKIE, str(tech["id"]), max_age=365 * 86400, httponly=True, samesite="strict")
        return resp

    @app.post("/who/clear")
    def who_clear():
        resp = go("/who")
        resp.delete_cookie(TECH_COOKIE)
        return resp

    # ---- units ------------------------------------------------------------

    @app.get("/units", response_class=HTMLResponse)
    def unit_list(request: Request, status: str = "", q: str = "", conn=Depends(get_conn), actor=Depends(current_actor)):
        return render(request, "units.html", actor=actor, rows=units.listing(conn, status or None, q.strip() or None),
                      status=status, q=q)

    @app.post("/units")
    def unit_new(barcode: str = Form(""), family: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        unit = units.create(conn, actor, barcode=barcode or None, family=family or None)
        return go(f"/units/{unit['id']}", msg="Opened a new record.")

    @app.get("/units/{unit_id}", response_class=HTMLResponse)
    def unit_page(request: Request, unit_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        unit = units.get(conn, unit_id)
        runs = qc.runs(conn, unit_id)
        latest = qc.latest_complete_run(conn, unit_id)
        draft = db.one(conn, "SELECT * FROM listing_drafts WHERE unit_id = ?", (unit_id,))
        return render(
            request, "unit.html", actor=actor, unit=unit, fam=families.get(unit["console_family"]),
            runs=[(r, qc.summary(conn, r["id"])) for r in runs], latest=latest,
            open_run=qc.open_run(conn, unit_id), steps=states.next_steps(conn, unit),
            repairs=units.repairs(conn, unit_id), photos=units.photo_set(conn, unit_id),
            files=[a for a in units.attachments(conn, unit_id) if not a["slot"]],
            events=units.events(conn, unit_id), devices=devices.for_unit(conn, unit_id),
            editable=unit["status"] in units.EDITABLE, draft=draft, export=listing.latest_export(conn, unit_id),
            name_of=lambda tid: units.tech_name(conn, tid),
        )

    @app.post("/units/{unit_id}/identity")
    def unit_identity(unit_id: int, console_family: str = Form(""), model_revision: str = Form(""),
                      serial_no: str = Form(""), intake_barcode: str = Form(""), mac_address: str = Form(""),
                      has_writable_storage: str = Form(""), notes: str = Form(""),
                      conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        unit = units.get(conn, unit_id)
        fields = dict(console_family=console_family, model_revision=model_revision, serial_no=serial_no,
                      intake_barcode=intake_barcode, mac_address=mac_address, notes=notes)
        # Only send the storage flag if the family didn't change, so a new
        # family picks up its own default; the tech can override after.
        if console_family == (unit["console_family"] or ""):
            fields["has_writable_storage"] = has_writable_storage == "1"
        units.update_identity(conn, actor, unit_id, **fields)
        with db.tx(conn):
            devices.learn(conn, unit_id)
        return go(f"/units/{unit_id}#identity", msg="Saved.")

    @app.post("/units/{unit_id}/firmware")
    def unit_firmware(unit_id: int, firmware_version: str = Form(""), conn=Depends(get_conn),
                      actor=Depends(current_actor)):
        units.set_firmware_entered(conn, need_tech(actor), unit_id, firmware_version)
        return go(f"/units/{unit_id}#identity", msg="Firmware confirmed.")

    @app.post("/units/{unit_id}/grade")
    def unit_grade(unit_id: int, grade: str = Form(""), notes: str = Form(""), conn=Depends(get_conn),
                   actor=Depends(current_actor)):
        units.set_grade(conn, need_tech(actor), unit_id, grade, notes)
        return go(f"/units/{unit_id}#cosmetic", msg="Grade saved.")

    @app.post("/units/{unit_id}/photos")
    def unit_photo(unit_id: int, slot: str = Form(""), file: UploadFile | None = File(None),
                   conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        if slot not in families.PHOTO_SLOTS:
            raise BenchError("Pick a photo slot.")
        _attach(conn, actor, unit_id, file, slot=slot)
        return go(f"/units/{unit_id}#cosmetic", msg=f"{slot.capitalize()} photo attached.")

    @app.post("/units/{unit_id}/files")
    def unit_file(unit_id: int, file: UploadFile | None = File(None), conn=Depends(get_conn),
                  actor=Depends(current_actor)):
        _attach(conn, need_tech(actor), unit_id, file)
        return go(f"/units/{unit_id}#files", msg="Attached.")

    def _attach(conn, actor, unit_id, file, slot=None, qc_result_id=None):
        if not file or not file.filename:
            raise BenchError("Choose a file first.")
        unit = units.get(conn, unit_id)
        units._require_editable(unit)
        meta = media.store_upload(file.file, file.filename, settings.media_dir, want="photo" if slot else None)
        try:
            row = units.add_attachment(conn, actor, unit_id, meta, slot=slot, qc_result_id=qc_result_id)
        except Exception:
            (settings.media_dir / meta["stored_name"]).unlink(missing_ok=True)
            raise
        if slot:
            qc.autopass_photo_item(conn, actor, unit_id, slot)
        return row

    @app.post("/units/{unit_id}/repairs")
    def unit_repair(unit_id: int, kind: str = Form(""), description: str = Form(""), conn=Depends(get_conn),
                    actor=Depends(current_actor)):
        units.add_repair(conn, need_tech(actor), unit_id, kind, description)
        return go(f"/units/{unit_id}#work", msg="Work logged.")

    @app.post("/units/{unit_id}/mod")
    def unit_mod(unit_id: int, mod_type: str = Form(""), mod_method_ref: str = Form(""), mod_firmware: str = Form(""),
                 conn=Depends(get_conn), actor=Depends(current_actor)):
        units.record_mod(conn, need_tech(actor), unit_id, mod_type, mod_method_ref, mod_firmware)
        return go(f"/units/{unit_id}#work", msg="Mod recorded.")

    @app.post("/units/{unit_id}/mod/clear")
    def unit_mod_clear(unit_id: int, reason: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        units.clear_mod(conn, need_tech(actor), unit_id, reason)
        return go(f"/units/{unit_id}#work", msg="Mod record removed.")

    @app.post("/units/{unit_id}/wipe")
    def unit_wipe(unit_id: int, method: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        units.record_wipe(conn, need_tech(actor), unit_id, method)
        return go(f"/units/{unit_id}#compliance", msg="Wipe recorded.")

    @app.post("/units/{unit_id}/attest")
    def unit_attest(unit_id: int, confirm: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        if confirm != "yes":
            raise BenchError("Tick the box to attest.")
        units.attest_no_games(conn, actor, unit_id)
        return go(f"/units/{unit_id}#compliance", msg="Attestation recorded.")

    @app.post("/units/{unit_id}/attest/withdraw")
    def unit_attest_withdraw(unit_id: int, reason: str = Form(""), conn=Depends(get_conn),
                             actor=Depends(current_actor)):
        units.withdraw_attestation(conn, need_tech(actor), unit_id, reason)
        return go(f"/units/{unit_id}#compliance", msg="Attestation withdrawn.")

    @app.post("/units/{unit_id}/transition")
    def unit_transition(unit_id: int, to: str = Form(""), reason: str = Form(""), sale_ref: str = Form(""),
                        conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        if to == "listed":
            raise BenchError("Export the listing to move a unit to listed.")
        unit = states.transition(conn, actor, unit_id, to, reason=reason or None, sale_ref=sale_ref or None)
        msg = f"Now {unit['status']}."
        if unit["status"] == "sold":
            msg += f" Set stock to 0 for {unit['listing_id']} in data/products.js -- the store won't do it."
        if unit["status"] == "failed" and unit["listing_id"]:
            msg += f" Take {unit['listing_id']} out of data/products.js."
        return go(f"/units/{unit_id}", msg=msg)

    @app.post("/units/{unit_id}/link-device")
    def unit_link_device(unit_id: int, code: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        d = devices.by_code(conn, code)
        if not d:
            raise BenchError(f"No device with code {code!r}. Load the intake page on the console to get one.")
        devices.attach(conn, actor, d["id"], unit_id)
        return go(f"/units/{unit_id}#identity", msg=f"Linked device {d['code']}.")

    # ---- QC ---------------------------------------------------------------

    @app.post("/units/{unit_id}/qc")
    def qc_start(unit_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        run_id = qc.start_run(conn, need_tech(actor), unit_id)
        return go(f"/units/{unit_id}/qc/{run_id}")

    @app.get("/units/{unit_id}/qc/{run_id}", response_class=HTMLResponse)
    def qc_page(request: Request, unit_id: int, run_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        unit = units.get(conn, unit_id)
        r = qc.run(conn, unit_id, run_id)
        rows = qc.results(conn, run_id)
        files = {}
        for a in units.attachments(conn, unit_id):
            if a["qc_result_id"]:
                files.setdefault(a["qc_result_id"], []).append(a)
        photos = units.photo_set(conn, unit_id)
        return render(request, "qc_run.html", actor=actor, unit=unit, run=r, rows=rows, files=files, photos=photos,
                      summary=qc.summary(conn, run_id), name_of=lambda tid: units.tech_name(conn, tid),
                      editable=unit["status"] in units.EDITABLE and not r["completed_at"])

    @app.post("/units/{unit_id}/qc/{run_id}/items/{result_id}")
    def qc_item(unit_id: int, run_id: int, result_id: int, result: str = Form(""), note: str = Form(""),
                file: UploadFile | None = File(None), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        row = db.one(conn, "SELECT * FROM qc_results WHERE id = ? AND run_id = ?", (result_id, run_id))
        if not row:
            raise BenchError("No such checklist item.")
        if result:
            qc.record_result(conn, actor, unit_id, run_id, result_id, result, note)
        has_file = file is not None and bool(file.filename)
        if has_file:
            if row["photo_slot"]:
                _attach(conn, actor, unit_id, file, slot=row["photo_slot"], qc_result_id=result_id)
            else:
                _attach(conn, actor, unit_id, file, qc_result_id=result_id)
        if not result and not has_file:
            raise BenchError("Tap Pass, Fail or N/A (or attach a file).")
        nxt = db.one(conn, "SELECT id FROM qc_results WHERE run_id = ? AND result IS NULL ORDER BY position, id LIMIT 1",
                     (run_id,))
        anchor = f"#item-{nxt['id']}" if nxt else "#finish"
        return go(f"/units/{unit_id}/qc/{run_id}{anchor}")

    @app.post("/units/{unit_id}/qc/{run_id}/complete")
    def qc_complete(unit_id: int, run_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        qc.complete_run(conn, need_tech(actor), unit_id, run_id)
        return go(f"/units/{unit_id}#qc", msg="QC sheet complete.")

    # ---- listing ----------------------------------------------------------

    @app.get("/units/{unit_id}/listing", response_class=HTMLResponse)
    def listing_page(request: Request, unit_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        unit = units.get(conn, unit_id)
        exported = listing.latest_export(conn, unit_id)
        if unit["status"] not in ("refurbished", "listable") and not exported:
            raise BenchError("Listings are drafted once a unit is refurbished.")
        draft = product = photo = None
        problems, warns = [], []
        if unit["status"] in ("refurbished", "listable"):
            draft = listing.get_draft(conn, unit, actor)
            product, photo, problems = listing.build_product(conn, unit, draft)
            warns = listing.warnings(unit, draft)
        snap = json.loads(exported["product_json"]) if exported else None
        return render(request, "listing.html", actor=actor, unit=unit, draft=draft, product=product, photo=photo,
                      problems=problems, warns=warns, exported=exported, snap=snap,
                      js=listing.to_js(product) if product and not problems else None,
                      json_text=listing.to_json(product) if product and not problems else None,
                      snap_js=listing.to_js(snap) if snap else None,
                      snap_json=listing.to_json(snap) if snap else None, conditions=listing.CONDITIONS)

    @app.post("/units/{unit_id}/listing")
    def listing_save(unit_id: int, name: str = Form(""), price: str = Form(""), condition: str = Form("refurbished"),
                     blurb: str = Form(""), details: str = Form(""), conn=Depends(get_conn),
                     actor=Depends(current_actor)):
        actor = need_tech(actor)
        try:
            cents = parse_price(price) if price.strip() else None
        except PriceError as e:
            raise BenchError(str(e))
        listing.save_draft(conn, actor, unit_id, name, cents, condition, blurb, details)
        return go(f"/units/{unit_id}/listing", msg="Draft saved.")

    @app.post("/units/{unit_id}/listing/regenerate")
    def listing_regen(unit_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        listing.regenerate(conn, need_tech(actor), unit_id)
        return go(f"/units/{unit_id}/listing", msg="Copy regenerated from the record.")

    @app.post("/units/{unit_id}/listing/export")
    def listing_export(unit_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        listing.export(conn, need_tech(actor), unit_id)
        return go(f"/units/{unit_id}/listing", msg="Exported. Unit is now listed -- commit the snippet to the site.")

    def _snapshot(conn, unit_id):
        row = listing.latest_export(conn, unit_id)
        if not row:
            raise BenchError("Nothing exported yet.")
        return row, json.loads(row["product_json"])

    @app.get("/units/{unit_id}/listing.js")
    def listing_js(unit_id: int, conn=Depends(get_conn)):
        row, product = _snapshot(conn, unit_id)
        return PlainTextResponse(listing.to_js(product), headers=_download(f"{product['id']}.js"))

    @app.get("/units/{unit_id}/listing.json")
    def listing_json(unit_id: int, conn=Depends(get_conn)):
        row, product = _snapshot(conn, unit_id)
        return Response(listing.to_json(product), media_type="application/json",
                        headers=_download(f"{product['id']}.json"))

    @app.get("/units/{unit_id}/listing.zip")
    def listing_zip(unit_id: int, conn=Depends(get_conn)):
        row, product = _snapshot(conn, unit_id)
        return Response(listing.bundle(conn, row, settings.media_dir), media_type="application/zip",
                        headers=_download(f"{product['id']}.zip"))

    def _download(filename):
        return {"Content-Disposition": f"attachment; filename=\"{quote(filename)}\""}

    # ---- media ------------------------------------------------------------

    @app.get("/media/{attachment_id}")
    def media_file(attachment_id: int, conn=Depends(get_conn)):
        a = db.one(conn, "SELECT * FROM attachments WHERE id = ?", (attachment_id,))
        if not a:
            return PlainTextResponse("Not found", status_code=404)
        disposition = "inline" if a["kind"] in ("photo", "clip") else "attachment"
        media_type = a["media_type"] + ("; charset=utf-8" if a["kind"] == "artifact" else "")
        return FileResponse(settings.media_dir / a["stored_name"], media_type=media_type,
                            headers={"Content-Disposition": f"{disposition}; filename=\"{a['stored_name']}\"",
                                     "Cache-Control": "private, max-age=86400"})

    # ---- network ----------------------------------------------------------

    @app.get("/network", response_class=HTMLResponse)
    def network(request: Request, conn=Depends(get_conn), actor=Depends(current_actor)):
        open_units = db.all_(conn, "SELECT * FROM units WHERE status IN ('received','tested','refurbished')"
                                   " ORDER BY id DESC LIMIT 100")
        return render(request, "network.html", actor=actor, rows=devices.everything(conn), open_units=open_units,
                      threads=_thread_status(threads))

    @app.post("/network/{device_id}/attach")
    def network_attach(device_id: int, unit_id: str = Form(""), conn=Depends(get_conn), actor=Depends(current_actor)):
        actor = need_tech(actor)
        unit = devices.attach(conn, actor, device_id, int(unit_id) if unit_id.isdigit() else None)
        return go(f"/units/{unit['id']}", msg="Device attached; fields pre-filled -- confirm them.")

    @app.post("/network/{device_id}/ignore")
    def network_ignore(device_id: int, ignored: str = Form("1"), conn=Depends(get_conn), actor=Depends(current_actor)):
        need_tech(actor)
        devices.set_ignored(conn, device_id, ignored == "1")
        return go("/network")

    # ---- QC templates -----------------------------------------------------

    @app.get("/qc-templates", response_class=HTMLResponse)
    def tpl_list(request: Request, conn=Depends(get_conn), actor=Depends(current_actor)):
        return render(request, "templates_list.html", actor=actor, rows=qc.templates(conn))

    @app.get("/qc-templates/{template_id}", response_class=HTMLResponse)
    def tpl_edit(request: Request, template_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        return render(request, "template_edit.html", actor=actor, tpl=qc.template(conn, template_id),
                      items=qc.template_items(conn, template_id))

    @app.post("/qc-templates/{template_id}/items")
    def tpl_add(template_id: int, section: str = Form(""), label: str = Form(""), guidance: str = Form(""),
                blocking: str = Form(""), photo_slot: str = Form(""), conn=Depends(get_conn),
                actor=Depends(current_actor)):
        need_tech(actor)
        qc.add_template_item(conn, template_id, section, label, guidance, blocking == "1", photo_slot or None)
        return go(f"/qc-templates/{template_id}", msg="Item added.")

    @app.post("/qc-template-items/{item_id}")
    def tpl_update(item_id: int, section: str = Form(""), label: str = Form(""), guidance: str = Form(""),
                   blocking: str = Form(""), photo_slot: str = Form(""), position: str = Form("0"),
                   conn=Depends(get_conn), actor=Depends(current_actor)):
        need_tech(actor)
        pos = int(position) if position.lstrip("-").isdigit() else 0
        tid = qc.update_template_item(conn, item_id, section, label, guidance, blocking == "1", photo_slot or None, pos)
        return go(f"/qc-templates/{tid}#tpl-item-{item_id}", msg="Item saved.")

    @app.post("/qc-template-items/{item_id}/delete")
    def tpl_delete(item_id: int, conn=Depends(get_conn), actor=Depends(current_actor)):
        need_tech(actor)
        tid = qc.delete_template_item(conn, item_id)
        return go(f"/qc-templates/{tid}", msg="Item removed. Past QC runs keep their copy.")

    # ---- health -----------------------------------------------------------

    @app.get("/healthz")
    def healthz():
        return JSONResponse({"ok": True, "threads": _thread_status(threads)})

    return app


def _thread_status(threads):
    return {name: ("running" if t.running else (t.error or "starting")) for name, t in threads.items()}


def _start_threads(settings, open_db, threads):
    from .dhcp import DhcpWatcher
    from .scanner import ScannerReader

    if settings.watch_iface:
        conn_lock = threading.Lock()
        conn = open_db()

        def on_packet(pkt):
            with conn_lock:
                devices.record_dhcp(conn, pkt["mac"], ip=pkt["ip"], hostname=pkt["hostname"],
                                    fingerprint=pkt["fingerprint"], vendor_class=pkt["vendor_class"])

        threads["dhcp"] = DhcpWatcher(settings.watch_iface, on_packet)
        threads["dhcp"].start()

    if settings.scanner_device:
        sconn = open_db()

        def on_scan(text):
            units.scan(sconn, units.SYSTEM_SCANNER, text)

        threads["scanner"] = ScannerReader(settings.scanner_device, on_scan)
        threads["scanner"].start()

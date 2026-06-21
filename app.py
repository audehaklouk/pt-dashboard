"""FastAPI application for PT Conversation Dashboard."""
from __future__ import annotations

import csv
import hashlib
import hmac
import os
import secrets
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import Cookie, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent

# Add BASE_DIR to path so we can import classifier
sys.path.insert(0, str(BASE_DIR))

from db import get_db, get_filter_options, init_db, insert_threads, query_threads, seed_db
from metrics import compute_metrics
from chat import run_chat, _check_rate

# --- In-memory metrics cache ---
import hashlib as _hashlib
import json as _json
import time as _time

_metrics_cache: dict[str, tuple[float, dict]] = {}  # key -> (timestamp, result)
_CACHE_TTL = 300  # 5 minutes

def _cache_key(brand, country, workspace, date_from, date_to) -> str:
    raw = _json.dumps([brand, country, workspace, date_from, date_to], sort_keys=True)
    return _hashlib.md5(raw.encode()).hexdigest()

def _get_cached(key: str) -> dict | None:
    entry = _metrics_cache.get(key)
    if entry and (_time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None

def _set_cached(key: str, data: dict) -> None:
    _metrics_cache[key] = (_time.time(), data)

def _invalidate_cache() -> None:
    _metrics_cache.clear()

app = FastAPI(title="PT Conversation Dashboard")

# --- Simple password gate ---
SITE_PASSWORD = os.environ.get("SITE_PASSWORD", "letsdeploymorethingstoprod2026")
# Token is a HMAC of the password so it changes if the password changes
_TOKEN = hmac.new(SITE_PASSWORD.encode(), b"pt-dashboard-auth", hashlib.sha256).hexdigest()

LOGIN_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PT Dashboard — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:#F4F7FC;display:flex;
  align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(16,24,40,.06),
  0 1px 2px rgba(16,24,40,.04);padding:2.5rem;width:100%;max-width:380px}
h1{font-size:1.25rem;font-weight:700;color:#0F1B3D;margin-bottom:.25rem}
p{font-size:.8rem;color:#5B6B8C;margin-bottom:1.5rem}
input{width:100%;padding:.65rem .85rem;border:1px solid #E6ECF5;border-radius:10px;
  font-size:.9rem;color:#0F1B3D;outline:none;transition:border .15s}
input:focus{border-color:#2D5BFF;box-shadow:0 0 0 3px rgba(45,91,255,.15)}
button{width:100%;margin-top:1rem;padding:.7rem;border:none;border-radius:10px;
  background:#2D5BFF;color:#fff;font-weight:600;font-size:.9rem;cursor:pointer;
  transition:background .15s}
button:hover{background:#1E40C8}
.err{color:#EF4444;font-size:.8rem;margin-top:.75rem}
</style></head><body>
<form class="card" method="POST" action="/login">
<h1>PT Conversation Dashboard</h1>
<p>Enter the password to continue.</p>
<input name="password" type="password" placeholder="Password" autofocus required>
<button type="submit">Enter</button>
__ERR__
</form></body></html>"""


def _is_authed(auth_token: Optional[str]) -> bool:
    if not auth_token:
        return False
    return hmac.compare_digest(auth_token, _TOKEN)


@app.get("/login", response_class=HTMLResponse)
def login_page():
    return LOGIN_HTML.replace("__ERR__", "")


@app.post("/login")
def login_submit(request: Request, password: str = Form(...)):
    if password == SITE_PASSWORD:
        resp = RedirectResponse(url="/", status_code=303)
        resp.set_cookie("auth_token", _TOKEN, httponly=True, max_age=60 * 60 * 24 * 30, samesite="lax")
        return resp
    html = LOGIN_HTML.replace("__ERR__", '<div class="err">Wrong password.</div>')
    return HTMLResponse(html, status_code=401)


import asyncio
import httpx

async def _keep_alive():
    """Ping ourselves every 4 minutes to prevent free-tier spin-down."""
    url = os.environ.get("RENDER_EXTERNAL_URL", "")
    if not url:
        return
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(240)
            try:
                await client.get(f"{url}/api/health", timeout=10)
            except Exception:
                pass

@app.on_event("startup")
def startup():
    init_db()
    seed_db()
    # Pre-warm cache for the default (unfiltered) view
    try:
        db = get_db()
        rows = query_threads(db)
        data = compute_metrics(rows)
        _set_cached(_cache_key(None, None, None, None, None), data)
        db.close()
    except Exception:
        pass
    asyncio.get_event_loop().create_task(_keep_alive())


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/filters")
def filters(auth_token: Optional[str] = Cookie(None)):
    if not _is_authed(auth_token):
        raise HTTPException(401, "Unauthorized")
    db = get_db()
    try:
        data = get_filter_options(db)
        return {"data": data, "error": None}
    finally:
        db.close()


@app.get("/api/threads")
def threads(
    brand: Optional[str] = Query(None),
    country: Optional[str] = Query(None),  # comma-separated
    workspace: Optional[str] = Query(None),  # comma-separated
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    auth_token: Optional[str] = Cookie(None),
):
    if not _is_authed(auth_token):
        raise HTTPException(401, "Unauthorized")

    # Check cache first
    ck = _cache_key(brand, country, workspace, date_from, date_to)
    cached = _get_cached(ck)
    if cached is not None:
        return {"data": cached, "error": None}

    db = get_db()
    try:
        countries = (
            [c.strip() for c in country.split(",")] if country else None
        )
        workspaces = (
            [w.strip() for w in workspace.split(",")] if workspace else None
        )
        rows = query_threads(
            db,
            brand=brand,
            countries=countries,
            workspaces=workspaces,
            date_from=date_from,
            date_to=date_to,
        )
        data = compute_metrics(rows)
        _set_cached(ck, data)
        return {"data": data, "error": None}
    finally:
        db.close()


@app.post("/api/import")
async def import_csv(
    file: UploadFile = File(...),
    workspace: str = Form(...),
    brand: str = Form(...),
    country: str = Form(...),
    auth_token: Optional[str] = Cookie(None),
):
    if not _is_authed(auth_token):
        raise HTTPException(401, "Unauthorized")
    # Validate brand
    if brand not in ("National", "Apex"):
        raise HTTPException(400, "Brand must be 'National' or 'Apex'")

    brand_label = (
        "National (Abwaab)" if brand == "National" else "International (Apex)"
    )

    # Save uploaded file to temp dir
    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, "upload.csv")
    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)

        # Validate header
        EXPECTED_HEADER = [
            "Date & Time",
            "Sender ID",
            "Sender Type",
            "Contact ID",
            "Message ID",
            "Content Type",
            "Message Type",
            "Content",
            "Channel ID",
            "Type",
            "Sub Type",
        ]
        with open(tmp_path, encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if header is None:
                raise HTTPException(400, "Empty file")
            # Strip BOM and whitespace
            header = [h.strip().strip("\ufeff") for h in header]
            if header != EXPECTED_HEADER:
                raise HTTPException(
                    400,
                    f"Invalid header. Expected: {EXPECTED_HEADER}. Got: {header}",
                )

        # Import classifier and process
        import classifier

        old_data = classifier.DATA
        classifier.DATA = tmp_dir
        try:
            recs = classifier.process_file(
                "upload.csv", brand, country, workspace
            )
        finally:
            classifier.DATA = old_data

        # Transform classifier output to seed schema
        thread_rows = []
        for rec in recs:
            row = {
                "workspace": workspace,
                "brand": brand,
                "brand_label": brand_label,
                "country": country,
                "thread_date": (
                    rec["first"].strftime("%Y-%m-%d") if rec.get("first") else ""
                ),
                "first": rec["first"].isoformat() if rec.get("first") else "",
                "last": rec["last"].isoformat() if rec.get("last") else "",
                "contact": rec["contact"],
                "n_msg": rec["n_msg"],
                "n_in": rec["n_in"],
                "n_out_human": rec["n_out_human"],
                "n_out_auto": rec["n_out_auto"],
                "has_inbound": 1 if rec["has_inbound"] else 0,
                "agent_replied": 1 if rec["agent_replied"] else 0,
                "first_resp_sec": rec.get("first_resp_sec"),
                "last_role": rec["last_role"],
                "paylink_sent": rec["paylink_sent"],
                "paylink_dark": rec["paylink_dark"],
                "pricequote_sent": rec["pricequote_sent"],
                "pricequote_dark": rec["pricequote_dark"],
                "priceask": rec["priceask"],
                "askparent": rec["askparent"],
                "askparent_dark": rec.get("askparent_dark"),
                "agentsched_sent": rec["agentsched_sent"],
                "agentsched_dark": rec["agentsched_dark"],
                "booked": rec["booked"],
                "cust_paid": rec["cust_paid"],
                "agent_confirm": rec["agent_confirm"],
                "obj_price": rec["obj_price"],
                "ask_discount": rec["ask_discount"],
                "obj_think": rec["obj_think"],
                "obj_busy": rec["obj_busy"],
                "obj_online": rec["obj_online"],
                "trial_req": rec["trial_req"],
                "tutor_qual": rec["tutor_qual"],
                "entry_tpl": rec["entry_tpl"],
                "cap_resched": rec["cap_resched"],
                "cap_avail": rec["cap_avail"],
                "cap_prog": rec["cap_prog"],
                "cap_cancel": rec["cap_cancel"],
                "cap_rec": rec["cap_rec"],
                "parent_sig": rec["parent_sig"],
                "student_sig": rec["student_sig"],
                "n_broadcast": rec["n_broadcast"],
                "n_workflow": rec["n_workflow"],
                "reached_link": rec.get("reached_link", 0),
                "t_trial_offer": rec.get("t_trial_offer", 0),
                "t_trial_req": rec.get("t_trial_req", 0),
                "t_trial_done": rec.get("t_trial_done", 0),
                "t_exam": rec.get("t_exam", 0),
                "t_price": rec.get("t_price", 0),
                "t_teacher": rec.get("t_teacher", 0),
                "t_competitor": rec.get("t_competitor", 0),
                "t_logistics": rec.get("t_logistics", 0),
                "t_social": rec.get("t_social", 0),
            }
            thread_rows.append(row)

        # Insert into DB
        db = get_db()
        try:
            count = insert_threads(db, thread_rows)
            _invalidate_cache()
            dates = [r["thread_date"] for r in thread_rows if r["thread_date"]]
            date_span = [min(dates), max(dates)] if dates else []
            return {
                "data": {
                    "rows_added": count,
                    "date_span": date_span,
                    "skipped": len(recs) - count,
                },
                "error": None,
            }
        finally:
            db.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/api/chat")
async def chat_endpoint(request: Request, auth_token: Optional[str] = Cookie(None)):
    if not _is_authed(auth_token):
        raise HTTPException(401, "Unauthorized")
    ip = request.client.host if request.client else "unknown"
    if not _check_rate(ip):
        raise HTTPException(429, "Rate limit exceeded. Try again in a minute.")
    body = await request.json()
    message = (body.get("message") or "").strip()
    session_id = body.get("session_id") or "default"
    model_key = body.get("model") or None
    if not message or len(message) > 2000:
        raise HTTPException(400, "Message required (max 2000 chars)")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return JSONResponse({"reply": "AI chat is not configured — ANTHROPIC_API_KEY is missing.", "error": None})
    try:
        reply = run_chat(session_id, message, model_key=model_key)
        return {"reply": reply, "error": None}
    except Exception as e:
        return JSONResponse({"reply": None, "error": str(e)}, status_code=500)


# Serve frontend static files
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIR / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str, auth_token: Optional[str] = Cookie(None)):
        # Allow login page without auth
        if full_path == "login":
            return LOGIN_HTML.replace("__ERR__", "")
        # Check auth
        if not _is_authed(auth_token):
            return RedirectResponse(url="/login", status_code=303)
        # Try serving the exact file first
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Fallback to index.html for SPA routing
        return FileResponse(str(FRONTEND_DIR / "index.html"))

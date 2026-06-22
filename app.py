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
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

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

# --- Session middleware (needed for OAuth state) ---
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)

# --- Google OAuth ---
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
ALLOWED_DOMAIN = "abwaab.com"

oauth = OAuth()
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

# --- Auth cookie signing ---
_COOKIE_SECRET = os.environ.get("COOKIE_SECRET", SESSION_SECRET).encode()

def _sign_email(email: str) -> str:
    """Create a signed token from an email address."""
    sig = hmac.new(_COOKIE_SECRET, email.encode(), hashlib.sha256).hexdigest()
    return f"{email}:{sig}"

def _verify_signed(token: str) -> str | None:
    """Verify a signed token and return the email, or None if invalid."""
    if ":" not in token:
        return None
    email, sig = token.rsplit(":", 1)
    expected = hmac.new(_COOKIE_SECRET, email.encode(), hashlib.sha256).hexdigest()
    if hmac.compare_digest(sig, expected):
        return email
    return None


def _is_authed(auth_token: Optional[str]) -> bool:
    if not auth_token:
        return False
    email = _verify_signed(auth_token)
    if email and email.endswith(f"@{ALLOWED_DOMAIN}"):
        return True
    return False


# --- Login page ---
def _login_html(error: str = "") -> str:
    err_block = f'<div class="err">{error}</div>' if error else ""

    google_btn = """
    <a href="/auth/google" class="google-btn">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Sign in with Google
    </a>
    """

    domain_note = f'<p class="domain">Only <strong>@{ALLOWED_DOMAIN}</strong> accounts are allowed.</p>'

    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PT Dashboard — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Inter',system-ui,sans-serif;background:#F4F7FC;display:flex;
  align-items:center;justify-content:center;min-height:100vh}}
.card{{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(16,24,40,.06),
  0 1px 2px rgba(16,24,40,.04);padding:2.5rem;width:100%;max-width:380px;text-align:center}}
h1{{font-size:1.25rem;font-weight:700;color:#0F1B3D;margin-bottom:.25rem}}
p{{font-size:.8rem;color:#5B6B8C;margin-bottom:1.5rem}}
.domain{{font-size:.75rem;color:#94A3B8;margin-top:1rem;margin-bottom:0}}
.domain strong{{color:#5B6B8C}}
.google-btn{{display:flex;align-items:center;justify-content:center;gap:.6rem;
  width:100%;padding:.75rem;border:1px solid #E6ECF5;border-radius:10px;
  background:#fff;color:#0F1B3D;font-weight:600;font-size:.9rem;cursor:pointer;
  transition:all .15s;text-decoration:none}}
.google-btn:hover{{background:#F8FAFF;border-color:#2D5BFF;box-shadow:0 0 0 3px rgba(45,91,255,.1)}}
.err{{color:#EF4444;font-size:.8rem;margin-top:.75rem}}
</style></head><body>
<form class="card" method="POST" action="/login">
<h1>PT Conversation Dashboard</h1>
<p>Sign in to access the dashboard.</p>
{google_btn}
{err_block}
{domain_note}
</form></body></html>"""


@app.get("/login", response_class=HTMLResponse)
def login_page(error: Optional[str] = Query(None)):
    return _login_html(error or "")


@app.get("/auth/google")
async def google_login(request: Request):
    """Redirect to Google consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google OAuth is not configured")
    redirect_uri = request.url_for("google_callback")
    # Force HTTPS in production (Render terminates TLS at the proxy)
    redirect_uri = str(redirect_uri)
    if redirect_uri.startswith("http://") and os.environ.get("RENDER"):
        redirect_uri = redirect_uri.replace("http://", "https://", 1)
    return await oauth.google.authorize_redirect(request, redirect_uri, prompt="select_account")


@app.get("/auth/callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback."""
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        return RedirectResponse(url="/login?error=Authentication+failed.+Please+try+again.", status_code=303)

    user_info = token.get("userinfo")
    if not user_info:
        return RedirectResponse(url="/login?error=Could+not+get+user+info+from+Google.", status_code=303)

    email = (user_info.get("email") or "").lower().strip()
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        return RedirectResponse(
            url=f"/login?error=Only+@{ALLOWED_DOMAIN}+accounts+are+allowed.+You+signed+in+as+{email}",
            status_code=303,
        )

    # Set signed auth cookie
    signed = _sign_email(email)
    resp = RedirectResponse(url="/", status_code=303)
    resp.set_cookie("auth_token", signed, httponly=True, max_age=60 * 60 * 24 * 30, samesite="lax")
    return resp


@app.get("/logout")
def logout():
    resp = RedirectResponse(url="/login", status_code=303)
    resp.delete_cookie("auth_token")
    return resp


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
        # Allow auth-related routes without cookie check
        if full_path in ("login", "logout") or full_path.startswith("auth/"):
            return RedirectResponse(url=f"/{full_path}", status_code=307)
        # Check auth
        if not _is_authed(auth_token):
            return RedirectResponse(url="/login", status_code=303)
        # Try serving the exact file first
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Fallback to index.html for SPA routing
        return FileResponse(str(FRONTEND_DIR / "index.html"))

"""FastAPI application for PT Conversation Dashboard."""
import csv
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent

# Add BASE_DIR to path so we can import classifier
sys.path.insert(0, str(BASE_DIR))

from db import get_db, get_filter_options, init_db, insert_threads, query_threads, seed_db
from metrics import compute_metrics

app = FastAPI(title="PT Conversation Dashboard")


@app.on_event("startup")
def startup():
    init_db()
    seed_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/filters")
def filters():
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
):
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
        return {"data": data, "error": None}
    finally:
        db.close()


@app.post("/api/import")
async def import_csv(
    file: UploadFile = File(...),
    workspace: str = Form(...),
    brand: str = Form(...),
    country: str = Form(...),
):
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


# Serve frontend static files
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIR / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try serving the exact file first
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Fallback to index.html for SPA routing
        return FileResponse(str(FRONTEND_DIR / "index.html"))

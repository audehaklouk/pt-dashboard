# Claude Code build prompt — PT Conversation Dashboard

Paste everything below into Claude Code, with this folder (`PT_Dashboard_Handoff/`) as the working directory so it can read `seed/seed_threads.csv`, `seed/seed_metrics_reference.json`, `classifier.py`, and `DATA_DICTIONARY.md`.

---

You are building a **live, filterable analytics dashboard** for our tutoring (PT) sales/support conversations, to be deployed on **Render** and used by non-technical stakeholders in roadmap meetings. Work in this directory. Read `DATA_DICTIONARY.md` first — it defines the data schema and the exact metric formulas. Do not invent metrics; implement the formulas in §2 of the dictionary verbatim so the dashboard matches our signed-off report.

## What the data is
- `seed/seed_threads.csv` — 27,881 rows, one per conversation, already classified (brand, country, workspace, date, and boolean event flags). No message text. This is the seed; the dashboard loads it on first run.
- `classifier.py` — the Python pipeline that turns a raw Respond.io CSV export into rows in the seed schema. The Import feature must reuse this exact file so new data matches the seed format.
- `seed/seed_metrics_reference.json` — the precomputed aggregate numbers from our report. Use it to **write automated tests** that assert your dashboard reproduces these numbers for the unfiltered (all-data) view. Examples to assert: National (KSA+Qatar) engaged two-way = 10,411; payment-link continuation = 91.3%; trial-request booking lift ≈ 5.7×; Apex-KSA two-way% = 34.3%.

## Architecture (build exactly this)
- **Backend:** FastAPI (Python 3.11). Reuse `classifier.py`. Persist data in **SQLite** (file on a Render persistent disk). Endpoints:
  - `GET /api/threads?filters…` → returns aggregated metrics for the current filter set (do aggregation server-side for speed; the per-thread table never goes to the browser in full).
  - `GET /api/filters` → distinct workspaces, brands, countries, and the min/max date for populating filter controls.
  - `POST /api/import` (multipart) → fields: `file` (Respond.io CSV), `workspace`, `brand` (`National`|`Apex`), `country`. Validate the 11-column header (see dictionary §3); reject with a clear message if it doesn't match. Run `classifier.py`, tag rows with workspace/brand/country, insert into SQLite, return a summary (rows added, date span, any skipped rows).
  - `GET /api/health`.
  - On first boot, if the DB is empty, **load `seed/seed_threads.csv` automatically.**
- **Frontend:** React + Vite + Recharts + Tailwind. Built to static files and **served by the same FastAPI app** (one Render service, no CORS headaches). Clean, executive look; works on laptop and projector; responsive.

## Global filters (top bar, affect every chart)
1. **Date range** (uses `thread_date`) — presets: This month / Last 30 days / Year to date / Custom.
2. **Brand** — National (Abwaab) / International (Apex) / All.
3. **Country** — KSA / Qatar / UAE / Bahrain / Jordan / All (multi-select).
4. **Workspace** — multi-select (e.g. `National — KSA`, `Apex — Qatar`).
Filters are AND-combined, persist in the URL (shareable links), and every panel recomputes from the filtered set.

## Panels (use the §2 formulas exactly)
1. **Funnel** — Threads → Inbound → Two-way → Reached price → Payment link → Booked, as a horizontal funnel with counts and stage-over-stage %.
2. **Drop-off map** — bar chart: % going silent after a price quote, after a payment link, after a schedule proposal (with the denominators shown).
3. **Payment-link continuation** — donut: continued vs went-dark; plus booked-of-link %. Caption: this is the in-app-payment case.
4. **Objections / concerns** — ranked horizontal bars, % of engaged threads, per the dictionary list.
5. **Capability requests** — ranked bars by count (reschedule, recording, progress, availability, cancel/refund).
6. **Response & SLA** — first-response median & p90 (minutes) and no-reply %, by workspace.
7. **Buyer type** — parent vs student vs unknown (small multiples or stacked bar).
8. **Headline tiles** at top: Threads, Two-way rate, Payment-link reach %, Booked-proxy %, Median first response — all reactive to filters.

## Robustness & stakeholder-readiness (required)
- Every panel: loading state, empty state, and a **"small sample (n<30)" badge** when the filtered engaged-n is below 30 (mirrors our MODERATE/THIN evidence tags).
- Persistent footer disclaimer: *"Covers only people who already messaged us — conversion & product signal, not acquisition. 'Booked' is a lower-bound proxy, not a close rate."*
- Import: validate header, show a preview of what will be added, handle bad/edge files gracefully, never crash on malformed `Content` JSON (the classifier already guards this).
- Tests: a `pytest` suite asserting the seed reproduces `seed_metrics_reference.json` numbers (±0.1%), plus an import round-trip test on a small sample CSV.
- Accessibility: legible on a projector, color-blind-safe palette, number formatting with thousands separators and one-decimal percentages.
- Export: a "Download current view (CSV/PNG)" button per chart for slide decks.

## Deployment (Render)
- Single **Render Web Service** (Python). `render.yaml` with: build = install Python deps + `npm ci && npm run build` for the frontend; start = `uvicorn app:app --host 0.0.0.0 --port $PORT`. FastAPI serves the built `frontend/dist`.
- Attach a **Render Persistent Disk** for the SQLite file so imports survive restarts. Document the disk mount path in the README you generate.
- Provide a one-command local run (`make dev` or a script) and a README with setup, deploy, and "how to import a new workspace export" steps for a non-technical user.

## Deliverables
A working repo: `app.py` (FastAPI), `classifier.py` (reused), `frontend/` (React/Vite), `render.yaml`, `tests/`, `README.md`, and the SQLite seeded from `seed/seed_threads.csv`. Start by reading `DATA_DICTIONARY.md`, then scaffold backend + one panel + the test that matches `seed_metrics_reference.json`, get that green, then build the rest.

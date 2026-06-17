# PT Conversation Dashboard

A live, filterable analytics dashboard for PT tutoring sales and support conversations. Built on 27,881 classified conversation threads across 7 workspaces (National KSA, National Qatar, Apex KSA, Apex Qatar, Apex UAE, Apex Bahrain, Apex Jordan). Displays funnel metrics, drop-off rates, objection analysis, response SLA, payment continuation, and booking correlates -- all recomputed on the fly as filters change.

## Quick Start (Local)

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies and build
cd frontend && npm ci && npm run build && cd ..

# Run the server (seeds database automatically on first boot)
uvicorn app:app --host 0.0.0.0 --port 8000

# Open http://localhost:8000
```

Or for development with hot-reload:

```bash
# Terminal 1: Backend
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend (proxies API to :8000)
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

Or use the Makefile shortcut:

```bash
make dev    # Starts both backend and frontend
make build  # Production frontend build
make test   # Run all tests
make clean  # Remove generated artifacts
```

## How to Import a New Workspace Export

1. Export conversations from Respond.io as CSV (the standard 11-column format: Date & Time, Sender ID, Sender Type, Contact ID, Message ID, Content Type, Message Type, Content, Channel ID, Type, Sub Type).
2. Click the **Import** button in the dashboard filter bar.
3. Select the CSV file.
4. Enter the metadata: **Workspace** name (e.g., "National \u2014 KSA"), **Brand** (National or Apex), and **Country** (e.g., KSA, Qatar).
5. Click Import. The server runs the classifier pipeline on the raw messages, inserts the resulting thread rows into the database, and the dashboard recomputes metrics to include the new data.

**Note:** Respond.io CSVs do not contain workspace/brand/country metadata, so you must tag each upload manually. This is by design -- automatic channel-ID mapping is fragile and caused the original KSA/Qatar mislabeling.

## Deploying on Render

1. Push this repo to GitHub.
2. Create a new **Web Service** on Render and connect the repo.
3. Render will detect and use `render.yaml` automatically.
4. Attach a **Persistent Disk** at `/var/data` (1 GB is sufficient for this volume).
5. Deploy. On first boot, the server auto-loads `seed/seed_threads.csv` into the SQLite database on the persistent disk. Imports and data survive restarts.

The `render.yaml` configures:
- Build: installs Python deps + builds the React frontend
- Start: runs `uvicorn app:app` serving both API and static frontend
- Disk: 1 GB persistent disk mounted at `/var/data` for the SQLite DB

## Running Tests

```bash
pip install pytest httpx
python -m pytest tests/ -v
```

The test suite validates that the dashboard reproduces every number in the signed-off report:

- **test_metrics.py** -- the critical file. Asserts funnel counts, percentages, payment continuation, drop-off rates, objection counts, capability totals, response SLA medians, buyer type splits, and booking-correlate lifts against `seed/seed_metrics_reference.json`. Integer metrics must match exactly; percentages allow +/-0.15 tolerance.
- **test_import.py** -- validates the CSV import endpoint (header validation, brand validation), health check, filters endpoint, and the threads API returning correct totals.

## Data and Metrics

The dashboard computes all metrics from per-thread boolean flags stored in SQLite. Each row in the `threads` table represents one conversation thread with pre-classified fields (paylink_sent, pricequote_sent, booked, obj_price, trial_req, etc.). The classifier pipeline (`classifier.py`) produces these flags from raw Respond.io message exports using audited keyword/regex rules for Arabic and English.

Key metric definitions:
- **Funnel:** threads > inbound > two-way engaged (inbound + agent replied + 2+ customer messages) > reached price > payment link > booked
- **Payment continuation:** of threads that received a payment link, what percentage continued responding (vs went dark)
- **Drop-off:** percentage that went dark after each event (price quote, payment link, schedule proposal)
- **Objections:** counted among engaged threads only (denominator = two-way engaged)
- **Capabilities:** counted among engaged threads only
- **Response SLA:** median first-response time in minutes, no-reply percentage

See `DATA_DICTIONARY.md` for the complete schema and formula definitions.

## Persistent Disk

The SQLite database is stored at the path set by the `DB_PATH` environment variable. On Render, this should point to the persistent disk mount (e.g., `/var/data/dashboard.db`). Locally, it defaults to `./data/dashboard.db`. The database is created and seeded automatically on first boot if empty.

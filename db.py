"""SQLite initialization, seeding, and query helpers for PT Dashboard."""
import csv
import os
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "data" / "dashboard.db"))

COLUMNS = [
    ("workspace", "TEXT"),
    ("brand", "TEXT"),
    ("brand_label", "TEXT"),
    ("country", "TEXT"),
    ("thread_date", "TEXT"),
    ("first", "TEXT"),
    ("last", "TEXT"),
    ("contact", "TEXT"),
    ("n_msg", "INTEGER"),
    ("n_in", "INTEGER"),
    ("n_out_human", "INTEGER"),
    ("n_out_auto", "INTEGER"),
    ("has_inbound", "INTEGER"),
    ("agent_replied", "INTEGER"),
    ("first_resp_sec", "REAL"),
    ("last_role", "TEXT"),
    ("paylink_sent", "INTEGER"),
    ("paylink_dark", "INTEGER"),
    ("pricequote_sent", "INTEGER"),
    ("pricequote_dark", "INTEGER"),
    ("priceask", "INTEGER"),
    ("askparent", "INTEGER"),
    ("askparent_dark", "INTEGER"),
    ("agentsched_sent", "INTEGER"),
    ("agentsched_dark", "INTEGER"),
    ("booked", "INTEGER"),
    ("cust_paid", "INTEGER"),
    ("agent_confirm", "INTEGER"),
    ("obj_price", "INTEGER"),
    ("ask_discount", "INTEGER"),
    ("obj_think", "INTEGER"),
    ("obj_busy", "INTEGER"),
    ("obj_online", "INTEGER"),
    ("trial_req", "INTEGER"),
    ("tutor_qual", "INTEGER"),
    ("entry_tpl", "INTEGER"),
    ("cap_resched", "INTEGER"),
    ("cap_avail", "INTEGER"),
    ("cap_prog", "INTEGER"),
    ("cap_cancel", "INTEGER"),
    ("cap_rec", "INTEGER"),
    ("parent_sig", "INTEGER"),
    ("student_sig", "INTEGER"),
    ("n_broadcast", "INTEGER"),
    ("n_workflow", "INTEGER"),
    ("reached_link", "INTEGER"),
    ("t_trial_offer", "INTEGER"),
    ("t_trial_req", "INTEGER"),
    ("t_trial_done", "INTEGER"),
    ("t_exam", "INTEGER"),
    ("t_price", "INTEGER"),
    ("t_teacher", "INTEGER"),
    ("t_competitor", "INTEGER"),
    ("t_logistics", "INTEGER"),
    ("t_social", "INTEGER"),
]

# Columns where "True"/"False" strings must be converted to 1/0
BOOL_COLUMNS = {"has_inbound", "agent_replied"}

# Columns where empty strings should be stored as NULL
NULLABLE_COLUMNS = {"paylink_dark", "pricequote_dark", "askparent_dark",
                     "agentsched_dark", "first_resp_sec"}

# Integer columns (for type coercion during seed import)
INTEGER_COLUMNS = {name for name, typ in COLUMNS if typ == "INTEGER"}

# Real columns (for type coercion during seed import)
REAL_COLUMNS = {name for name, typ in COLUMNS if typ == "REAL"}

COL_NAMES = [c[0] for c in COLUMNS]


def get_db() -> sqlite3.Connection:
    """Return a connection with Row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the threads table if it does not exist."""
    # Ensure the data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    col_defs = ", ".join(f"{name} {typ}" for name, typ in COLUMNS)
    ddl = f"CREATE TABLE IF NOT EXISTS threads ({col_defs})"

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(ddl)
        # Indexes for filtered queries
        conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_brand ON threads(brand)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_country ON threads(country)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_workspace ON threads(workspace)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_date ON threads(thread_date)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_brand_date ON threads(brand, thread_date)")
        conn.commit()
    finally:
        conn.close()


def _coerce_value(col: str, raw: str):
    """Convert a raw CSV string to the appropriate Python type for insertion."""
    # Boolean columns: "True"/"False" -> 1/0
    if col in BOOL_COLUMNS:
        if raw == "True":
            return 1
        if raw == "False":
            return 0
        # fallback: empty string -> 0
        return 0

    # Nullable columns: empty string -> None
    if col in NULLABLE_COLUMNS and (raw is None or raw == ""):
        return None

    # Integer columns
    if col in INTEGER_COLUMNS:
        if raw is None or raw == "":
            return None
        try:
            return int(raw)
        except (ValueError, TypeError):
            return None

    # Real columns
    if col in REAL_COLUMNS:
        if raw is None or raw == "":
            return None
        try:
            return float(raw)
        except (ValueError, TypeError):
            return None

    # Text columns: return as-is
    return raw


def seed_db() -> None:
    """If the threads table is empty, load from seed/seed_threads.csv."""
    conn = sqlite3.connect(DB_PATH)
    try:
        count = conn.execute("SELECT COUNT(*) FROM threads").fetchone()[0]
        if count > 0:
            return

        seed_path = BASE_DIR / "seed" / "seed_threads.csv"
        if not seed_path.exists():
            return

        placeholders = ", ".join("?" for _ in COL_NAMES)
        insert_sql = f"INSERT INTO threads ({', '.join(COL_NAMES)}) VALUES ({placeholders})"

        with open(seed_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            batch = []
            for row in reader:
                values = tuple(_coerce_value(col, row.get(col, "")) for col in COL_NAMES)
                batch.append(values)
                if len(batch) >= 5000:
                    conn.executemany(insert_sql, batch)
                    batch.clear()
            if batch:
                conn.executemany(insert_sql, batch)

        conn.commit()
    finally:
        conn.close()


def get_filter_options(db: sqlite3.Connection) -> dict:
    """Return distinct values for all filterable dimensions plus date range."""
    workspaces = [r[0] for r in db.execute(
        "SELECT DISTINCT workspace FROM threads ORDER BY workspace").fetchall()]
    brands = [r[0] for r in db.execute(
        "SELECT DISTINCT brand FROM threads ORDER BY brand").fetchall()]
    brand_labels = [r[0] for r in db.execute(
        "SELECT DISTINCT brand_label FROM threads ORDER BY brand_label").fetchall()]
    countries = [r[0] for r in db.execute(
        "SELECT DISTINCT country FROM threads ORDER BY country").fetchall()]
    date_range = db.execute(
        "SELECT MIN(thread_date), MAX(thread_date) FROM threads").fetchone()

    return {
        "workspaces": workspaces,
        "brands": brands,
        "brand_labels": brand_labels,
        "countries": countries,
        "date_min": date_range[0],
        "date_max": date_range[1],
    }


def query_threads(
    db: sqlite3.Connection,
    brand: Optional[str] = None,
    countries: Optional[List[str]] = None,
    workspaces: Optional[List[str]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[sqlite3.Row]:
    """Query threads with optional filters. All filters are AND-combined."""
    clauses: List[str] = []
    params: List = []

    if brand:
        clauses.append("brand = ?")
        params.append(brand)

    if countries:
        placeholders = ", ".join("?" for _ in countries)
        clauses.append(f"country IN ({placeholders})")
        params.extend(countries)

    if workspaces:
        placeholders = ", ".join("?" for _ in workspaces)
        clauses.append(f"workspace IN ({placeholders})")
        params.extend(workspaces)

    if date_from:
        clauses.append("thread_date >= ?")
        params.append(date_from)

    if date_to:
        clauses.append("thread_date <= ?")
        params.append(date_to)

    sql = "SELECT * FROM threads"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)

    return db.execute(sql, params).fetchall()


def insert_threads(db: sqlite3.Connection, rows: List[dict]) -> int:
    """Insert a list of thread dicts into the table. Returns count inserted."""
    if not rows:
        return 0

    placeholders = ", ".join("?" for _ in COL_NAMES)
    insert_sql = f"INSERT INTO threads ({', '.join(COL_NAMES)}) VALUES ({placeholders})"

    inserted = 0
    for row in rows:
        values = tuple(row.get(col) for col in COL_NAMES)
        db.execute(insert_sql, values)
        inserted += 1

    db.commit()
    return inserted

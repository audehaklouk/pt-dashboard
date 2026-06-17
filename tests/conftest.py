import pytest
import os
import sys
import sqlite3
import json

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope="session")
def reference():
    """Load the reference metrics JSON."""
    ref_path = os.path.join(os.path.dirname(__file__), '..', 'seed', 'seed_metrics_reference.json')
    with open(ref_path) as f:
        return json.load(f)


@pytest.fixture(scope="session")
def db():
    """Initialize and seed the database for testing."""
    from db import init_db, seed_db, get_db

    # Use a test-specific DB
    os.environ['DB_PATH'] = os.path.join(os.path.dirname(__file__), 'test_dashboard.db')
    init_db()
    seed_db()
    conn = get_db()
    yield conn
    conn.close()
    # Cleanup
    try:
        os.remove(os.environ['DB_PATH'])
    except Exception:
        pass


@pytest.fixture(scope="session")
def all_rows(db):
    """Get all rows from the DB."""
    from db import query_threads
    return query_threads(db)


@pytest.fixture(scope="session")
def all_metrics(all_rows):
    """Compute metrics for all data."""
    from metrics import compute_metrics
    return compute_metrics(all_rows)

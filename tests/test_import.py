"""Tests for CSV import, health endpoint, and API routes."""
import pytest
import os
import sys
import csv
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def test_import_header_validation():
    """Test that import rejects files with wrong headers."""
    from fastapi.testclient import TestClient
    from app import app

    client = TestClient(app)

    # Create a bad CSV
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    tmp.write("bad,header,format\n")
    tmp.write("1,2,3\n")
    tmp.close()

    try:
        with open(tmp.name, 'rb') as f:
            response = client.post('/api/import',
                files={'file': ('test.csv', f, 'text/csv')},
                data={'workspace': 'Test', 'brand': 'National', 'country': 'KSA'})
        assert response.status_code == 400
    finally:
        os.unlink(tmp.name)


def test_import_brand_validation():
    """Test that import rejects invalid brand."""
    from fastapi.testclient import TestClient
    from app import app

    client = TestClient(app)

    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    writer = csv.writer(tmp)
    writer.writerow([
        "Date & Time", "Sender ID", "Sender Type", "Contact ID",
        "Message ID", "Content Type", "Message Type", "Content",
        "Channel ID", "Type", "Sub Type",
    ])
    writer.writerow([
        "2026-01-01 10:00:00", "s1", "contact", "c1",
        "m1", "text", "message", '{"type":"text","text":"hello"}',
        "ch1", "message", "",
    ])
    tmp.close()

    try:
        with open(tmp.name, 'rb') as f:
            response = client.post('/api/import',
                files={'file': ('test.csv', f, 'text/csv')},
                data={'workspace': 'Test', 'brand': 'InvalidBrand', 'country': 'KSA'})
        assert response.status_code == 400
    finally:
        os.unlink(tmp.name)


def test_health():
    """Test health endpoint."""
    from fastapi.testclient import TestClient
    from app import app

    client = TestClient(app)
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_filters_endpoint():
    """Test filters endpoint returns valid data."""
    from fastapi.testclient import TestClient
    from app import app

    client = TestClient(app)
    response = client.get('/api/filters')
    assert response.status_code == 200
    data = response.json()['data']
    assert 'workspaces' in data
    assert 'brands' in data
    assert 'countries' in data


def test_threads_endpoint():
    """Test threads endpoint returns metrics."""
    from fastapi.testclient import TestClient
    from app import app

    client = TestClient(app)
    response = client.get('/api/threads')
    assert response.status_code == 200
    data = response.json()['data']
    assert data['funnel']['threads'] == 27881
    assert 'headlines' in data
    assert 'objections' in data

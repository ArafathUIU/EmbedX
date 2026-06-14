from __future__ import annotations

import json
import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
import app.routers.analytics as analytics_mod


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def temp_data_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        log_file = os.path.join(tmp, "query_log.jsonl")
        monkeypatch.setattr(analytics_mod, "ANALYTICS_FILE", log_file)
        analytics_mod._ensure_dir()
        yield


async def test_analytics_empty(client: AsyncClient):
    response = await client.get("/api/v1/analytics/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_queries"] == 0


async def test_analytics_with_data(client: AsyncClient):
    for _ in range(3):
        analytics_mod.log_query(
            question="test",
            answer="answer",
            chunks_count=2,
            model="test-model",
            latency_ms=100.0,
            document_ids=["doc-1"],
        )

    response = await client.get("/api/v1/analytics/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_queries"] == 3
    assert data["avg_chunks_per_query"] == 2.0

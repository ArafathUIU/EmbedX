from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def mock_qdrant_scroll():
    with patch("app.services.vector_store.QdrantClient") as mock:
        instance = mock.return_value
        instance.get_collections.return_value.collections = []

        class FakePoint:
            id = "p1"
            version = 0
            score = 1.0
            payload = {"text": "test", "chunk_id": "c1", "document_id": "doc-1"}

        instance.scroll.return_value = ([FakePoint()], None)
        yield mock


async def test_list_documents(mock_qdrant_scroll, client: AsyncClient):
    response = await client.get("/api/v1/documents")
    assert response.status_code == 200
    data = response.json()
    assert "documents" in data
    assert "total" in data


async def test_delete_document(mock_qdrant_scroll, client: AsyncClient):
    response = await client.delete("/api/v1/documents/doc-1")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"

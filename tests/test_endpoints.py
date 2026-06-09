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
def mock_qdrant():
    with patch("app.services.vector_store.QdrantClient") as mock:
        instance = mock.return_value
        instance.get_collections.return_value.collections = []
        instance.search.return_value = [
            type(
                "ScoredPoint",
                (),
                {
                    "id": "1",
                    "version": 0,
                    "score": 0.95,
                    "payload": {"text": "test chunk", "chunk_id": "c1"},
                },
            )()
        ]
        yield mock


@pytest.fixture
def mock_llm():
    with patch("app.services.llm_client.OpenAI") as mock:
        instance = mock.return_value
        instance.chat.completions.create.return_value = type(
            "Completion",
            (),
            {
                "choices": [
                    type("Choice", (), {
                        "message": type("Message", (), {
                            "content": "Mocked answer from DeepSeek",
                        })(),
                    })(),
                ],
            },
        )()
        yield mock


async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


async def test_ingest_endpoint(mock_qdrant, client: AsyncClient):
    response = await client.post(
        "/api/v1/ingest",
        data={"document_id": "doc-1", "metadata": '{"source": "test"}'},
        files={
            "file": (
                "test.txt",
                b"This is a test document. It has multiple sentences. Here is another one.",
            )
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["document_id"] == "doc-1"
    assert data["chunks_indexed"] > 0


async def test_ingest_rejects_empty_file(mock_qdrant, client: AsyncClient):
    response = await client.post(
        "/api/v1/ingest",
        data={"document_id": "doc-1"},
        files={"file": ("test.txt", b"")},
    )
    assert response.status_code == 400


async def test_query_endpoint(mock_qdrant, mock_llm, client: AsyncClient):
    response = await client.post(
        "/api/v1/query",
        json={"question": "What is this about?", "top_k": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["question"] == "What is this about?"
    assert "answer" in data
    assert len(data["chunks"]) > 0


async def test_query_returns_model_field(mock_qdrant, mock_llm, client: AsyncClient):
    response = await client.post(
        "/api/v1/query",
        json={"question": "test"},
    )
    data = response.json()
    assert data["model"] is not None

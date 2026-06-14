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
        instance.query_points.return_value = type(
            "QueryResponse",
            (),
            {
                "points": [
                    type(
                        "ScoredPoint",
                        (),
                        {
                            "id": "1",
                            "version": 0,
                            "score": 0.95,
                            "payload": {"text": "test chunk", "chunk_id": "c1", "document_id": "doc-1"},
                        },
                    )()
                ],
            },
        )()
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
                    type(
                        "Choice",
                        (),
                        {
                            "message": type(
                                "Message",
                                (),
                                {"content": "Mocked answer"},
                            )(),
                        },
                    )(),
                ],
            },
        )()
        yield mock


async def test_query_with_document_ids(mock_qdrant, mock_llm, client: AsyncClient):
    response = await client.post(
        "/api/v1/query",
        json={"question": "test", "document_ids": ["doc-1"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["question"] == "test"
    assert "answer" in data

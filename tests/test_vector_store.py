from __future__ import annotations

from unittest.mock import patch

from app.services.vector_store import VectorStore


class FakeCollection:
    def __init__(self):
        self.created = False
        self.points = []

    def upsert(self, points):
        for p in points:
            self.points.append(p)


class FakeClient:
    def __init__(self):
        self.collections_manager = self
        self._collections = []
        self.collection = FakeCollection()

    def get_collections(self):
        class Collections:
            collections = self._collections
        return Collections()

    def search(self, *args, **kwargs):
        return []

    def delete(self, *args, **kwargs):
        pass

    def create_collection(self, *args, **kwargs):
        pass

    def upsert(self, *args, **kwargs):
        pass


@patch("app.services.vector_store.QdrantClient", return_value=FakeClient())
def test_vector_store_initialization(_mock_client):
    store = VectorStore()
    assert store._collection_name == "embedx_documents"


@patch("app.services.vector_store.QdrantClient")
def test_upsert_calls_client(mock_client_class):
    mock_instance = mock_client_class.return_value
    mock_instance.get_collections.return_value.collections = []

    store = VectorStore()
    store.upsert(
        vectors=[[0.1] * 384],
        payloads=[{"text": "test"}],
        ids=["chunk-1"],
    )
    mock_instance.upsert.assert_called_once()


@patch("app.services.vector_store.QdrantClient")
def test_search_returns_results(mock_client_class):
    from qdrant_client.http.models import ScoredPoint

    mock_instance = mock_client_class.return_value
    mock_instance.get_collections.return_value.collections = []
    mock_instance.search.return_value = [
        ScoredPoint(id="1", version=0, score=0.95, payload={"text": "result"}),
    ]

    store = VectorStore()
    results = store.search(query_vector=[0.1] * 384, top_k=3)
    assert len(results) == 1
    assert results[0]["text"] == "result"
    assert results[0]["score"] == 0.95

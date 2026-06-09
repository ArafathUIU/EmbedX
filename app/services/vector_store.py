from __future__ import annotations

from functools import lru_cache
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

from app.config import settings


class VectorStore:
    def __init__(self) -> None:
        self._client = QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key or None
        )
        self._collection_name = settings.qdrant_collection_name
        self._vector_size = settings.vector_dimension
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        collections = [c.name for c in self._client.get_collections().collections]
        if self._collection_name not in collections:
            self._client.create_collection(
                collection_name=self._collection_name,
                vectors_config=qdrant_models.VectorParams(
                    size=self._vector_size,
                    distance=qdrant_models.Distance.COSINE,
                ),
            )

    def upsert(
        self,
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
        ids: list[str],
    ) -> None:
        points = [
            qdrant_models.PointStruct(id=pid, vector=vec, payload=payload)
            for pid, vec, payload in zip(ids, vectors, payloads)
        ]
        self._client.upsert(collection_name=self._collection_name, points=points)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_payload: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        query_filter = None
        if filter_payload:
            conditions = [
                qdrant_models.FieldCondition(key=k, match=qdrant_models.MatchValue(value=v))
                for k, v in filter_payload.items()
            ]
            query_filter = qdrant_models.Filter(must=conditions)

        results = self._client.search(
            collection_name=self._collection_name,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return [{"id": r.id, "score": r.score, **r.payload} for r in results]

    def delete_by_document(self, document_id: str) -> None:
        self._client.delete(
            collection_name=self._collection_name,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="document_id",
                            match=qdrant_models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
        )


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore()

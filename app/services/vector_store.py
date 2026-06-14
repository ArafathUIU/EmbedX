from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from qdrant_client.http.models import Filter as QdrantFilter

from app.config import settings

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self) -> None:
        self._client: QdrantClient | None = None
        self._collection_name = settings.qdrant_collection_name
        self._vector_size = settings.vector_dimension

    @property
    def client(self) -> QdrantClient:
        if self._client is None:
            if settings.qdrant_url:
                self._client = QdrantClient(
                    url=settings.qdrant_url,
                    api_key=settings.qdrant_api_key or None,
                )
            else:
                self._client = QdrantClient(path=settings.qdrant_local_path)
            self._ensure_collection()
        return self._client

    def _ensure_collection(self) -> None:
        try:
            collections = [c.name for c in self.client.get_collections().collections]
            if self._collection_name not in collections:
                self.client.create_collection(
                    collection_name=self._collection_name,
                    vectors_config=qdrant_models.VectorParams(
                        size=self._vector_size,
                        distance=qdrant_models.Distance.COSINE,
                    ),
                )
        except Exception:
            logger.warning(
                "Could not ensure Qdrant collection exists, vector store may not be available",
                exc_info=True,
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
        self.client.upsert(collection_name=self._collection_name, points=points)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter_payload: dict[str, Any] | None = None,
        qdrant_filter: QdrantFilter | None = None,
    ) -> list[dict[str, Any]]:
        query_filter = qdrant_filter
        if filter_payload and qdrant_filter is None:
            conditions = [
                qdrant_models.FieldCondition(key=k, match=qdrant_models.MatchValue(value=v))
                for k, v in filter_payload.items()
            ]
            query_filter = qdrant_models.Filter(must=conditions)

        response = self.client.query_points(
            collection_name=self._collection_name,
            query=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return [{"id": p.id, "score": p.score, **p.payload} for p in response.points]

    def delete_by_document(self, document_id: str) -> None:
        self.client.delete(
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

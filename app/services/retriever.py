from __future__ import annotations

import logging
from functools import lru_cache

from qdrant_client.http import models as qdrant_models

from app.config import settings
from app.schemas import ChunkResult
from app.services.embedder import get_embedder
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)


class Retriever:
    def retrieve(
        self, query: str, top_k: int | None = None, document_ids: list[str] | None = None
    ) -> list[ChunkResult]:
        k = top_k or settings.top_k_retrieval
        embedder = get_embedder()
        store = get_vector_store()

        query_vector = embedder.embed_query(query)

        if document_ids and len(document_ids) > 1:
            query_filter = qdrant_models.Filter(
                should=[
                    qdrant_models.FieldCondition(
                        key="document_id",
                        match=qdrant_models.MatchValue(value=did),
                    )
                    for did in document_ids
                ]
            )
            try:
                results = store.search(
                    query_vector=query_vector, top_k=k, qdrant_filter=query_filter
                )
            except Exception:
                logger.warning("Vector store search failed, returning empty results", exc_info=True)
                return []
            return [
                ChunkResult(
                    chunk_id=str(r.get("chunk_id", r["id"])),
                    text=str(r["text"]),
                    score=round(float(r["score"]), 4),
                )
                for r in results
            ]

        filter_payload = None
        if document_ids and len(document_ids) == 1:
            filter_payload = {"document_id": document_ids[0]}

        try:
            results = store.search(
                query_vector=query_vector, top_k=k, filter_payload=filter_payload
            )
        except Exception:
            logger.warning("Vector store search failed, returning empty results", exc_info=True)
            return []

        return [
            ChunkResult(
                chunk_id=str(r.get("chunk_id", r["id"])),
                text=str(r["text"]),
                score=round(float(r["score"]), 4),
            )
            for r in results
        ]

    def format_context(self, chunks: list[ChunkResult]) -> str:
        return "\n\n".join(f"[{i + 1}] {c.text}" for i, c in enumerate(chunks))


@lru_cache
def get_retriever() -> Retriever:
    return Retriever()

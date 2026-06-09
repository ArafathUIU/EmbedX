from __future__ import annotations

from functools import lru_cache

from app.config import settings
from app.schemas import ChunkResult
from app.services.embedder import get_embedder
from app.services.vector_store import get_vector_store


class Retriever:
    def retrieve(self, query: str, top_k: int | None = None) -> list[ChunkResult]:
        k = top_k or settings.top_k_retrieval
        embedder = get_embedder()
        store = get_vector_store()

        query_vector = embedder.embed_query(query)
        results = store.search(query_vector=query_vector, top_k=k)

        return [
            ChunkResult(
                chunk_id=str(r.get("chunk_id", r["id"])),
                text=str(r["text"]),
                score=round(float(r["score"]), 4),
            )
            for r in results
        ]

    def format_context(self, chunks: list[ChunkResult]) -> str:
        return "\n\n".join(
            f"[{i + 1}] {c.text}" for i, c in enumerate(chunks)
        )


@lru_cache()
def get_retriever() -> Retriever:
    return Retriever()

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import ChunkResult, QueryRequest, QueryResponse
from app.services.embedder import get_embedder
from app.services.vector_store import get_vector_store

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    embedder = get_embedder()
    store = get_vector_store()

    query_vector = embedder.embed_query(request.question)

    top_k = request.top_k or settings.top_k_retrieval
    results = store.search(query_vector=query_vector, top_k=top_k)

    chunks = [
        ChunkResult(
            chunk_id=str(r.get("chunk_id", r["id"])),
            text=str(r["text"]),
            score=round(float(r["score"]), 4),
        )
        for r in results
    ]

    return QueryResponse(
        question=request.question,
        answer=None,
        chunks=chunks,
        model=None,
    )

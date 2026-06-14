from __future__ import annotations

import logging
import time

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.routers.analytics import log_query
from app.schemas import ChunkResult, QueryRequest
from app.services.embedder import get_embedder
from app.services.llm_client import get_llm_client
from app.services.retriever import get_retriever
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter()


class ExplainPoint(BaseModel):
    chunk_id: str
    text: str
    score: float
    x: float
    y: float


class ExplainResponse(BaseModel):
    question: str
    answer: str | None
    model: str | None
    chunks: list[ChunkResult]
    query_x: float
    query_y: float
    points: list[ExplainPoint]
    similarity_matrix: list[list[float]]


def _pca_2d(vectors: list[list[float]]) -> list[list[float]]:
    arr = np.array(vectors, dtype=np.float64)
    mean = arr.mean(axis=0, keepdims=True)
    centered = arr - mean
    u, s, _vt = np.linalg.svd(centered, full_matrices=False)
    coords = u[:, :2] * s[:2]
    return coords.tolist()


@router.post("/query/explain", response_model=ExplainResponse)
async def query_explain(request: QueryRequest):
    retriever = get_retriever()
    llm = get_llm_client()
    embedder = get_embedder()
    store = get_vector_store()

    start = time.time()

    query_vector = embedder.embed_query(request.question)

    filter_payload = None
    qdrant_filter = None
    if request.document_ids:
        from qdrant_client.http import models as qdrant_models

        if len(request.document_ids) == 1:
            filter_payload = {"document_id": request.document_ids[0]}
        else:
            qdrant_filter = qdrant_models.Filter(
                should=[
                    qdrant_models.FieldCondition(
                        key="document_id",
                        match=qdrant_models.MatchValue(value=did),
                    )
                    for did in request.document_ids
                ]
            )

    try:
        raw_results = store.search(
            query_vector=query_vector,
            top_k=request.top_k,
            filter_payload=filter_payload,
            qdrant_filter=qdrant_filter,
            with_vectors=True,
        )
    except Exception:
        logger.warning("Vector store search failed", exc_info=True)
        raw_results = []

    chunks = [
        ChunkResult(
            chunk_id=str(r.get("chunk_id", r["id"])),
            text=str(r["text"]),
            score=round(float(r["score"]), 4),
        )
        for r in raw_results
    ]

    context = retriever.format_context(chunks)
    try:
        answer = llm.generate(prompt=request.question, context=context)
    except Exception:
        logger.warning("LLM generation failed", exc_info=True)
        answer = (
            "Unable to generate an answer. Please check that the "
            "LLM_API_KEY is configured and the LLM service is available."
        )

    latency = (time.time() - start) * 1000
    log_query(
        question=request.question,
        answer=answer,
        chunks_count=len(chunks),
        model=settings.llm_model,
        latency_ms=latency,
        document_ids=request.document_ids,
    )

    chunk_vectors: list[list[float]] = []
    for r in raw_results:
        vec = r.get("vector")
        if vec and isinstance(vec, list) and len(vec) > 0:
            chunk_vectors.append(vec)

    all_vectors = [query_vector] + chunk_vectors
    points: list[ExplainPoint] = []
    query_x = 0.0
    query_y = 0.0

    if len(all_vectors) >= 2:
        coords = _pca_2d(all_vectors)
        query_x, query_y = coords[0]
        for i, r in enumerate(raw_results):
            if i < len(coords) - 1:
                cx, cy = coords[i + 1]
                points.append(
                    ExplainPoint(
                        chunk_id=str(r.get("chunk_id", r["id"])),
                        text=str(r.get("text", ""))[:120],
                        score=round(float(r["score"]), 4),
                        x=cx,
                        y=cy,
                    )
                )
    elif len(chunk_vectors) == 1:
        points.append(
            ExplainPoint(
                chunk_id=str(chunks[0].chunk_id),
                text=chunks[0].text[:120],
                score=chunks[0].score,
                x=1.0,
                y=0.0,
            )
        )
        query_x = -1.0
        query_y = 0.0

    sim_matrix: list[list[float]] = []
    n = len(chunks)
    for i in range(n):
        row = []
        for j in range(n):
            if i < len(chunk_vectors) and j < len(chunk_vectors):
                a = np.array(chunk_vectors[i], dtype=np.float64)
                b = np.array(chunk_vectors[j], dtype=np.float64)
                sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
                row.append(round(sim, 4))
            else:
                row.append(0.0)
        sim_matrix.append(row)

    return ExplainResponse(
        question=request.question,
        answer=answer,
        model=settings.llm_model,
        chunks=chunks,
        query_x=query_x,
        query_y=query_y,
        points=points,
        similarity_matrix=sim_matrix,
    )

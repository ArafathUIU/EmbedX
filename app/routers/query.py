from __future__ import annotations

import logging
import time

from fastapi import APIRouter

from app.config import settings
from app.routers.analytics import log_query
from app.schemas import QueryRequest, QueryResponse
from app.services.llm_client import get_llm_client
from app.services.retriever import get_retriever

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    retriever = get_retriever()
    llm = get_llm_client()

    start = time.time()
    chunks = retriever.retrieve(request.question, top_k=request.top_k, document_ids=request.document_ids)

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

    return QueryResponse(
        question=request.question,
        answer=answer,
        chunks=chunks,
        model=settings.llm_model,
    )

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.config import settings
from app.schemas import QueryRequest, QueryResponse
from app.services.llm_client import get_llm_client
from app.services.retriever import get_retriever

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    retriever = get_retriever()
    llm = get_llm_client()

    chunks = retriever.retrieve(request.question, top_k=request.top_k)

    context = retriever.format_context(chunks)
    try:
        answer = llm.generate(prompt=request.question, context=context)
    except Exception:
        logger.warning("LLM generation failed", exc_info=True)
        answer = (
            "Unable to generate an answer. Please check that the "
            "LLM_API_KEY is configured and the LLM service is available."
        )

    return QueryResponse(
        question=request.question,
        answer=answer,
        chunks=chunks,
        model=settings.llm_model,
    )

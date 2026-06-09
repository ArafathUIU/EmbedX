from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.schemas import QueryRequest, QueryResponse
from app.services.llm_client import get_llm_client
from app.services.retriever import get_retriever

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    retriever = get_retriever()
    llm = get_llm_client()

    chunks = retriever.retrieve(request.question, top_k=request.top_k)

    context = retriever.format_context(chunks)
    answer = llm.generate(prompt=request.question, context=context)

    return QueryResponse(
        question=request.question,
        answer=answer,
        chunks=chunks,
        model=settings.llm_model,
    )

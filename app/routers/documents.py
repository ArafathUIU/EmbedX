from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from qdrant_client.http import models as qdrant_models
from pydantic import BaseModel

from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter()


class DocumentSummary(BaseModel):
    document_id: str
    chunk_count: int


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]
    total: int


class DeleteResponse(BaseModel):
    document_id: str
    status: str = "deleted"


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents():
    store = get_vector_store()
    try:
        docs: dict[str, int] = {}
        offset: str | None = None
        while True:
            points, next_offset = store.client.scroll(
                collection_name=store._collection_name,
                limit=1000,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for p in points:
                did = (p.payload or {}).get("document_id", "")
                if did:
                    docs[did] = docs.get(did, 0) + 1
            if next_offset:
                offset = next_offset
            else:
                break
    except Exception:
        logger.warning("Failed to scroll documents", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list documents")

    summaries = [
        DocumentSummary(document_id=did, chunk_count=count)
        for did, count in sorted(docs.items(), key=lambda x: x[0])
    ]
    return DocumentListResponse(documents=summaries, total=len(summaries))


@router.delete("/documents/{document_id}", response_model=DeleteResponse)
async def delete_document(document_id: str):
    store = get_vector_store()
    try:
        store.delete_by_document(document_id)
    except Exception:
        logger.warning("Failed to delete document %s", document_id, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete document")
    return DeleteResponse(document_id=document_id)

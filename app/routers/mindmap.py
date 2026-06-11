from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.mindmap import get_mindmap_service

router = APIRouter()


@router.get("/mindmap/{document_id}")
async def get_mindmap(
    document_id: str,
    threshold: float = Query(default=0.4, ge=0.0, le=1.0),
):
    service = get_mindmap_service()
    return service.get_mindmap(document_id, similarity_threshold=threshold)

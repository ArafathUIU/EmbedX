from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import IngestResponse
from app.services.chunker import get_chunker
from app.services.embedder import get_embedder
from app.services.vector_store import get_vector_store

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    document_id: str = Form(..., min_length=1, max_length=256),
    metadata: str = Form("{}"),
    file: UploadFile = File(...),
):
    import json

    chunker = get_chunker()
    embedder = get_embedder()
    store = get_vector_store()

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be a UTF-8 text file")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    raw_chunks = chunker.chunk(text)
    if not raw_chunks:
        raise HTTPException(status_code=400, detail="No content to index after chunking")

    texts = [c["text"] for c in raw_chunks]
    chunk_ids = [c["chunk_id"] for c in raw_chunks]
    embeddings = embedder.embed(texts)

    try:
        parsed_metadata = json.loads(metadata)
    except json.JSONDecodeError:
        parsed_metadata = {}

    payloads = [
        {
            "document_id": document_id,
            "chunk_id": cid,
            "text": txt,
            **parsed_metadata,
        }
        for cid, txt in zip(chunk_ids, texts)
    ]

    store.upsert(vectors=embeddings, payloads=payloads, ids=chunk_ids)

    return IngestResponse(document_id=document_id, chunks_indexed=len(raw_chunks))

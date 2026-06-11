from __future__ import annotations

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import IngestResponse
from app.services.chunker import get_chunker
from app.services.embedder import get_embedder
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter()

ENCODINGS = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16", "utf-16-le", "utf-16-be"]


def _extract_text(content: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            import io
            from PyPDF2 import PdfReader
        except ImportError:
            raise HTTPException(
                status_code=400,
                detail="PDF support requires PyPDF2. Install: pip install PyPDF2",
            )
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(p.extract_text() or "" for p in reader.pages)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        return text

    if ext in ("docx", "doc"):
        raise HTTPException(
            status_code=400,
            detail="DOCX files are not supported. Please convert to TXT or PDF.",
        )

    for encoding in ENCODINGS:
        try:
            text = content.decode(encoding)
            if text.strip():
                logger.info("Decoded %s as %s", filename, encoding)
                return text
        except (UnicodeDecodeError, LookupError):
            continue

    raise HTTPException(
        status_code=400,
        detail=(
            f"Could not decode '{filename}'. "
            "Ensure it is a UTF-8 text file or PDF. "
            "For PDF support: pip install PyPDF2"
        ),
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    document_id: str = Form(..., min_length=1, max_length=256),
    metadata: str = Form("{}"),
    file: UploadFile = File(...),
):
    chunker = get_chunker()
    embedder = get_embedder()
    store = get_vector_store()

    content = await file.read()
    filename = file.filename or "unknown"

    text = _extract_text(content, filename)

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

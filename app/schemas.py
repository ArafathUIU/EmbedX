from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=256)
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    document_id: str
    chunks_indexed: int
    status: str = "success"


class ChunkResult(BaseModel):
    chunk_id: str
    text: str
    score: float


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2048)
    top_k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    question: str
    answer: str | None = None
    chunks: list[ChunkResult]
    model: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    uptime_seconds: float

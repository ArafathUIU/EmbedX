from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import analytics, conversations, documents, flashcards, ingest, mindmap, query


@asynccontextmanager
async def lifespan(app: FastAPI):
    _started_at = time.time()
    app.state.started_at = _started_at
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(query.router, prefix="/api/v1", tags=["query"])
app.include_router(mindmap.router, prefix="/api/v1", tags=["mindmap"])
app.include_router(flashcards.router, prefix="/api/v1", tags=["flashcards"])
app.include_router(documents.router, prefix="/api/v1", tags=["documents"])
app.include_router(conversations.router, prefix="/api/v1", tags=["conversations"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])


@app.get("/health")
async def health():
    started_at = getattr(app.state, "started_at", time.time())
    uptime = time.time() - started_at
    return {
        "status": "ok",
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
    }


frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ingest, query


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


@app.get("/health")
async def health():
    started_at = getattr(app.state, "started_at", time.time())
    uptime = time.time() - started_at
    return {
        "status": "ok",
        "version": settings.app_version,
        "uptime_seconds": round(uptime, 2),
    }

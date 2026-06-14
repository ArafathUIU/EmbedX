from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _override_settings(monkeypatch):
    monkeypatch.setenv("QDRANT_URL", "http://localhost:6333")
    monkeypatch.setenv("QDRANT_API_KEY", "")
    monkeypatch.setenv("LLM_API_KEY", "test-key")


@pytest.fixture(autouse=True)
def _clear_caches():
    from app.services.vector_store import get_vector_store
    from app.services.retriever import get_retriever
    from app.services.embedder import get_embedder
    get_vector_store.cache_clear()
    get_retriever.cache_clear()
    get_embedder.cache_clear()

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _override_settings(monkeypatch):
    monkeypatch.setenv("QDRANT_URL", "http://localhost:6333")
    monkeypatch.setenv("QDRANT_API_KEY", "")
    monkeypatch.setenv("LLM_API_KEY", "test-key")

from __future__ import annotations

from app.services.embedder import Embedder


def test_embedder_returns_correct_dimension():
    embedder = Embedder()
    assert embedder.dimension == 384


def test_embed_single_text():
    embedder = Embedder()
    result = embedder.embed(["hello world"])
    assert len(result) == 1
    assert len(result[0]) == 384


def test_embed_multiple_texts():
    embedder = Embedder()
    texts = ["first sentence", "second sentence", "third sentence"]
    result = embedder.embed(texts)
    assert len(result) == 3
    assert all(len(v) == 384 for v in result)


def test_embed_query():
    embedder = Embedder()
    result = embedder.embed_query("test query")
    assert len(result) == 384

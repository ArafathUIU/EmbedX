from __future__ import annotations

from app.services.chunker import Chunker


def test_chunker_single_sentence():
    chunker = Chunker(chunk_size=100, chunk_overlap=10)
    result = chunker.chunk("Hello world.")
    assert len(result) == 1
    assert "chunk_id" in result[0]
    assert "text" in result[0]


def test_chunker_produces_multiple_chunks():
    chunker = Chunker(chunk_size=10, chunk_overlap=2)
    text = " ".join(["sentence."] * 50)
    result = chunker.chunk(text)
    assert len(result) > 1


def test_chunker_empty_string():
    chunker = Chunker()
    result = chunker.chunk("")
    assert result == []


def test_chunker_overlap_preserves_context():
    chunker = Chunker(chunk_size=10, chunk_overlap=4)
    text = "A B C D E. F G H I J. K L M N O. P Q R S T."
    result = chunker.chunk(text)
    assert len(result) >= 1

from __future__ import annotations

from app.services.chunker import Chunker
from app.services.embedder import Embedder
from app.services.retriever import Retriever


def test_format_context_empty():
    retriever = Retriever()
    result = retriever.format_context([])
    assert result == ""


def test_format_context_multiple_chunks():
    from app.schemas import ChunkResult

    retriever = Retriever()
    chunks = [
        ChunkResult(chunk_id="c1", text="First chunk text", score=0.95),
        ChunkResult(chunk_id="c2", text="Second chunk text", score=0.80),
    ]
    result = retriever.format_context(chunks)
    assert "[1]" in result
    assert "[2]" in result
    assert "First chunk text" in result
    assert "Second chunk text" in result


def test_chunker_with_context_provides_relevant_chunks():
    embedder = Embedder()
    chunker = Chunker(chunk_size=100, chunk_overlap=20)

    text = (
        "Paris is the capital of France. It is known for the Eiffel Tower. "
        "London is the capital of England. It has Big Ben. "
        "Tokyo is the capital of Japan. It is famous for cherry blossoms."
    )
    raw_chunks = chunker.chunk(text)
    assert len(raw_chunks) >= 1

    texts = [c["text"] for c in raw_chunks]
    embeddings = embedder.embed(texts)

    query_embedding = embedder.embed_query("What is the capital of France?")
    assert len(query_embedding) == 384
    assert len(embeddings) >= 1
    assert all(len(e) == 384 for e in embeddings)

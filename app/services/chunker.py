from __future__ import annotations

import re
import uuid

from app.config import settings


class Chunker:
    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> None:
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap

    def chunk(self, text: str) -> list[dict[str, str]]:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks: list[dict[str, str]] = []
        current_chunk: list[str] = []
        current_length = 0

        for sentence in sentences:
            words = sentence.split()
            sentence_length = len(words)

            if current_length + sentence_length > self.chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append({"chunk_id": str(uuid.uuid4()), "text": chunk_text})
                overlap_start = max(0, len(current_chunk) - self.chunk_overlap)
                current_chunk = current_chunk[overlap_start:]
                current_length = sum(len(s.split()) for s in current_chunk)

            current_chunk.append(sentence)
            current_length += sentence_length

        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({"chunk_id": str(uuid.uuid4()), "text": chunk_text})

        return chunks


def get_chunker() -> Chunker:
    return Chunker()

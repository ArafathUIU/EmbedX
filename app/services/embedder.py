from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import settings


class Embedder:
    def __init__(self) -> None:
        self._model = SentenceTransformer(settings.embedding_model)

    @property
    def dimension(self) -> int:
        return self._model.get_embedding_dimension()

    def embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = self._model.encode(texts, normalize_embeddings=True)
        return [e.tolist() for e in embeddings]

    def embed_query(self, text: str) -> list[float]:
        return self.embed([text])[0]


@lru_cache
def get_embedder() -> Embedder:
    return Embedder()

from __future__ import annotations

import logging
from functools import lru_cache

import numpy as np
from qdrant_client.http import models as qdrant_models

from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)


class MindmapService:
    def get_mindmap(self, document_id: str, similarity_threshold: float = 0.4):
        store = get_vector_store()
        scroll_filter = qdrant_models.Filter(
            must=[
                qdrant_models.FieldCondition(
                    key="document_id",
                    match=qdrant_models.MatchValue(value=document_id),
                )
            ]
        )
        points = list(
            store.client.scroll(
                collection_name=store._collection_name,
                scroll_filter=scroll_filter,
                with_payload=True,
                with_vectors=True,
                limit=500,
            )[0]
        )

        if not points:
            return {"nodes": [], "edges": []}

        nodes = []
        vectors = []

        for i, p in enumerate(points):
            vector = p.vector
            if vector is None:
                continue
            nodes.append(
                {
                    "id": str(p.id),
                    "index": i,
                    "text": (p.payload or {}).get("text", "")[:120],
                    "full_text": (p.payload or {}).get("text", ""),
                }
            )
            vectors.append(vector)

        if len(vectors) < 2:
            return {"nodes": nodes, "edges": []}

        mat = np.array(vectors)
        mat = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-10)
        sim = np.dot(mat, mat.T)

        edges = []
        n = len(nodes)
        for i in range(n):
            for j in range(i + 1, n):
                score = float(sim[i][j])
                if score >= similarity_threshold:
                    edges.append(
                        {
                            "source": nodes[i]["id"],
                            "target": nodes[j]["id"],
                            "score": round(score, 3),
                        }
                    )

        edges.sort(key=lambda e: e["score"], reverse=True)

        return {"nodes": nodes, "edges": edges}


@lru_cache
def get_mindmap_service() -> MindmapService:
    return MindmapService()

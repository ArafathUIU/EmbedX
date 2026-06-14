from __future__ import annotations

import json
import logging
import os
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
ANALYTICS_FILE = os.path.join(DATA_DIR, "query_log.jsonl")


def _ensure_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def log_query(
    question: str,
    answer: str | None,
    chunks_count: int,
    model: str,
    latency_ms: float,
    document_ids: list[str] | None = None,
) -> None:
    _ensure_dir()
    entry = {
        "question": question,
        "answer_length": len(answer or ""),
        "chunks_count": chunks_count,
        "model": model,
        "latency_ms": round(latency_ms, 2),
        "document_ids": document_ids or [],
        "timestamp": datetime.now(UTC).isoformat(),
    }
    try:
        with open(ANALYTICS_FILE, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        logger.warning("Failed to log query", exc_info=True)


class AnalyticsStats(BaseModel):
    total_queries: int
    unique_questions: int
    avg_latency_ms: float
    avg_chunks_per_query: float
    top_questions: list[dict[str, Any]]
    queries_today: int
    queries_this_hour: int
    total_documents_queried: int


@router.get("/analytics/stats", response_model=AnalyticsStats)
async def get_analytics_stats():
    _ensure_dir()
    logs: list[dict[str, Any]] = []
    if os.path.exists(ANALYTICS_FILE):
        try:
            with open(ANALYTICS_FILE) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            logs.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except Exception:
            logger.warning("Failed to read analytics log", exc_info=True)

    total = len(logs)
    if total == 0:
        return AnalyticsStats(
            total_queries=0,
            unique_questions=0,
            avg_latency_ms=0.0,
            avg_chunks_per_query=0.0,
            top_questions=[],
            queries_today=0,
            queries_this_hour=0,
            total_documents_queried=0,
        )

    questions = [entry.get("question", "") for entry in logs]
    latencies = [entry.get("latency_ms", 0) for entry in logs]
    chunks = [entry.get("chunks_count", 0) for entry in logs]
    question_counts = Counter(questions)
    top_qs = [{"question": q, "count": c} for q, c in question_counts.most_common(10)]

    now = datetime.now(UTC)
    today_str = now.strftime("%Y-%m-%d")
    today_count = sum(1 for entry in logs if entry.get("timestamp", "").startswith(today_str))
    hour_str = now.strftime("%Y-%m-%dT%H")
    hour_count = sum(1 for entry in logs if entry.get("timestamp", "").startswith(hour_str))

    doc_ids_count = len(set(did for entry in logs for did in entry.get("document_ids", []) if did))

    return AnalyticsStats(
        total_queries=total,
        unique_questions=len(question_counts),
        avg_latency_ms=round(sum(latencies) / total, 2),
        avg_chunks_per_query=round(sum(chunks) / total, 2),
        top_questions=top_qs,
        queries_today=today_count,
        queries_this_hour=hour_count,
        total_documents_queried=doc_ids_count,
    )

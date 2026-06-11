from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

from app.config import settings
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter()


class FlashcardRequest(BaseModel):
    document_id: str
    card_count: int = 8


SYSTEM_PROMPT = (
    "You create flash cards from document content. "
    "Return ONLY a JSON array — no markdown, no explanation.\n"
    'Schema: [{"question": "...", "answer": "..."}, ...]\n'
    "Questions should test comprehension of the content.\n"
    "Answers should be concise (1-2 sentences).\n"
    "Cover diverse topics from across the document.\n"
    "Do NOT invent information not in the provided content."
)


def _get_document_text(document_id: str) -> str:
    store = get_vector_store()
    try:
        from qdrant_client.http import models as qdrant_models

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
                limit=500,
            )[0]
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to retrieve document chunks")

    if not points:
        raise HTTPException(
            status_code=404,
            detail=f"No chunks found for document '{document_id}'",
        )

    texts = [(p.payload or {}).get("text", "") for p in points]
    return "\n\n".join(t for t in texts if t)


def _call_llm(text: str, card_count: int) -> list[dict]:
    client = OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Create {card_count} flash cards from this document content.\n\n{text[:10000]}"
                ),
            },
        ],
        max_tokens=4096,
        temperature=0.4,
    )
    raw = response.choices[0].message.content or ""
    return _parse_json(raw, card_count)


def _parse_json(raw: str, expected_count: int = 8) -> list[dict]:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    # Try direct parse first
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [c for c in data if isinstance(c, dict) and "question" in c and "answer" in c]
    except json.JSONDecodeError:
        pass

    # Try to recover truncated JSON — close brackets
    repaired = cleaned.rstrip()
    if repaired and not repaired.endswith("]"):
        repaired += "\n]"
    try:
        data = json.loads(repaired)
        if isinstance(data, list):
            return [c for c in data if isinstance(c, dict) and "question" in c and "answer" in c]
    except json.JSONDecodeError:
        pass

    logger.warning("Failed to parse LLM flashcard JSON: %s", cleaned[:500])
    raise HTTPException(
        status_code=422,
        detail="LLM returned invalid JSON cards — please retry",
    )


@router.post("/flashcards")
async def generate_flashcards(req: FlashcardRequest):
    text = _get_document_text(req.document_id)
    if len(text) < 100:
        raise HTTPException(status_code=400, detail="Document has too little text for cards")

    try:
        cards = _call_llm(text, req.card_count)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("LLM flashcard generation failed: %s", e)
        raise HTTPException(status_code=502, detail="LLM generation failed — please retry")

    if not cards:
        raise HTTPException(status_code=422, detail="LLM produced no valid flash cards")

    return {"cards": cards, "total": len(cards)}

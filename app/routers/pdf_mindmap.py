from __future__ import annotations

import io
import json
import logging
import re

from fastapi import APIRouter, File, HTTPException, UploadFile
from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

SYSTEM_PROMPT = (
    "You are a document structure analyzer. "
    "Your job is to read document content and produce a JSON mindmap tree.\n\n"
    "Return ONLY valid JSON — no markdown fences, no commentary, no explanation.\n\n"
    "The JSON must follow this exact schema:\n"
    '{\n  "id": "root",\n  "label": "Document Title",\n'
    '  "children": [\n'
    '    {\n      "id": "1",\n      "label": "Major Section Name",\n'
    '      "children": [\n'
    '        { "id": "1.1", "label": "Key concept", "children": [] }\n'
    "      ]\n    }\n  ]\n}\n\n"
    "Rules:\n"
    "- Root node = the document's main title or central topic (infer if no explicit title)\n"
    "- Level 1 = 4-7 major sections/themes\n"
    "- Level 2-3 = key concepts or subtopics under each section\n"
    "- Max depth = 4 levels (root = 0)\n"
    "- Each label should be concise (1-8 words), descriptive, and meaningful\n"
    "- Include only the most important concepts — do not enumerate every paragraph\n"
    "- Children arrays can be empty if a node has no children\n"
    "- Every node must have id, label, and children fields"
)


def _extract_pdf_text(content: bytes) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(content))
    text = "\n".join(p.extract_text() or "" for p in reader.pages)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    return text


def _call_llm(text: str) -> dict:
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
                    "Analyze this document content and produce "
                    f"the mindmap JSON:\n\n{text[:12000]}"
                ),
            },
        ],
        max_tokens=2048,
        temperature=0.2,
    )
    raw = response.choices[0].message.content or ""
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON response: %s", cleaned[:300])
        raise HTTPException(status_code=422, detail="LLM returned invalid JSON mindmap tree")

    if not isinstance(data, dict) or "label" not in data:
        raise HTTPException(status_code=422, detail="LLM response missing required 'label' field")

    return data


@router.post("/pdf-mindmap")
async def pdf_mindmap(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF must be under 10MB")

    try:
        text = _extract_pdf_text(content)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")

    if len(text) < 50:
        raise HTTPException(status_code=400, detail="PDF contains too little text to analyze")

    try:
        tree = _call_llm(text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        raise HTTPException(status_code=502, detail="LLM analysis failed — please retry")

    return {"tree": tree, "text_length": len(text)}

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CONVERSATIONS_DIR = os.path.join(DATA_DIR, "conversations")


def _ensure_dir() -> None:
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)


def _conversation_path(conversation_id: str) -> str:
    return os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")


class MessageEntry(BaseModel):
    role: str
    content: str
    chunks: list[dict[str, Any]] | None = None
    model: str | None = None
    timestamp: str = ""


class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class ConversationUpdate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    messages: list[MessageEntry]
    created_at: str
    updated_at: str
    message_count: int


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(req: ConversationCreate):
    _ensure_dir()
    cid = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()
    data = {
        "id": cid,
        "title": req.title,
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    with open(_conversation_path(cid), "w") as f:
        json.dump(data, f)
    return ConversationResponse(
        id=cid,
        title=req.title,
        messages=[],
        created_at=now,
        updated_at=now,
        message_count=0,
    )


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations():
    _ensure_dir()
    try:
        files = sorted(
            [f for f in os.listdir(CONVERSATIONS_DIR) if f.endswith(".json")],
            reverse=True,
        )
    except FileNotFoundError:
        files = []

    summaries = []
    for fname in files:
        path = os.path.join(CONVERSATIONS_DIR, fname)
        try:
            with open(path) as f:
                data = json.load(f)
            summaries.append(
                ConversationSummary(
                    id=data.get("id", fname.replace(".json", "")),
                    title=data.get("title", "Untitled"),
                    created_at=data.get("created_at", ""),
                    updated_at=data.get("updated_at", ""),
                    message_count=len(data.get("messages", [])),
                )
            )
        except Exception:
            continue
    return ConversationListResponse(conversations=summaries, total=len(summaries))


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str):
    path = _conversation_path(conversation_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read conversation")
    messages = [MessageEntry(**m) for m in data.get("messages", [])]
    return ConversationResponse(
        id=data["id"],
        title=data.get("title", "Untitled"),
        messages=messages,
        created_at=data.get("created_at", ""),
        updated_at=data.get("updated_at", ""),
        message_count=len(messages),
    )


@router.put("/conversations/{conversation_id}/title", response_model=ConversationResponse)
async def update_conversation_title(conversation_id: str, req: ConversationUpdate):
    path = _conversation_path(conversation_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read conversation")
    if req.title is not None:
        data["title"] = req.title
    data["updated_at"] = datetime.now(UTC).isoformat()
    with open(path, "w") as f:
        json.dump(data, f)
    messages = [MessageEntry(**m) for m in data.get("messages", [])]
    return ConversationResponse(
        id=data["id"],
        title=data["title"],
        messages=messages,
        created_at=data.get("created_at", ""),
        updated_at=data["updated_at"],
        message_count=len(messages),
    )


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationResponse)
async def add_message(conversation_id: str, msg: MessageEntry):
    path = _conversation_path(conversation_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read conversation")
    if not msg.timestamp:
        msg.timestamp = datetime.now(UTC).isoformat()
    data.setdefault("messages", []).append(msg.model_dump())
    data["updated_at"] = datetime.now(UTC).isoformat()
    with open(path, "w") as f:
        json.dump(data, f)
    messages = [MessageEntry(**m) for m in data.get("messages", [])]
    return ConversationResponse(
        id=data["id"],
        title=data["title"],
        messages=messages,
        created_at=data.get("created_at", ""),
        updated_at=data["updated_at"],
        message_count=len(messages),
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    path = _conversation_path(conversation_id)
    if os.path.exists(path):
        os.remove(path)
    return {"status": "deleted", "id": conversation_id}

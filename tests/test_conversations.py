from __future__ import annotations

import json
import os
import tempfile

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.conversations import CONVERSATIONS_DIR, _ensure_dir


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def temp_data_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        conv_dir = os.path.join(tmp, "conversations")
        monkeypatch.setattr("app.routers.conversations.CONVERSATIONS_DIR", conv_dir)
        _ensure_dir()
        yield


async def test_create_conversation(client: AsyncClient):
    response = await client.post(
        "/api/v1/conversations",
        json={"title": "Test Chat"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Chat"
    assert data["message_count"] == 0
    assert "id" in data


async def test_list_conversations_empty(client: AsyncClient):
    response = await client.get("/api/v1/conversations")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


async def test_add_message(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/conversations",
        json={"title": "Chat"},
    )
    cid = create_resp.json()["id"]

    msg_resp = await client.post(
        f"/api/v1/conversations/{cid}/messages",
        json={"role": "user", "content": "Hello"},
    )
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert data["message_count"] == 1


async def test_delete_conversation(client: AsyncClient):
    create_resp = await client.post(
        "/api/v1/conversations",
        json={"title": "Chat"},
    )
    cid = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/conversations/{cid}")
    assert del_resp.status_code == 200

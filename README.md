# EmbedX

[![CI](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml)
[![Deploy](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml)

A production-grade Retrieval-Augmented Generation (RAG) system with a polished React frontend. Upload documents (TXT/PDF/MD/JSON), index them as vector embeddings in Qdrant (local or cloud), and ask questions grounded in your content via OpenCode Go (DeepSeek V4 Pro). Includes flashcard generation, mindmap visualization, conversation history, and usage analytics.

---

## Screenshots

| Page | Description |
|------|-------------|
| **Dashboard** | Health status, uptime, version, endpoint catalog, document count |
| **Documents** | Drag-and-drop upload, chunk results, indexed document list with delete |
| **Query** | Chat-style RAG Q&A with source chunks, conversation sidebar, document filter |
| **Notebook** | Interactive similarity graph of document chunks (HTML5 Canvas) |
| **Flashcards** | AI-generated Q&A flip cards from document content |
| **Analytics** | Query stats, latency, top questions, usage over time |

---

## Architecture

```
┌──────────────────┐     ┌──────────────────────────────────────────┐
│   React SPA      │────►│           FastAPI (REST)                  │
│   (Vite, TS)     │     │                                          │
│                   │     │  ┌────────────────────────────────┐      │
│   Dashboard      │     │  │   Document Ingestion Pipeline    │      │
│   Documents      │     │  │   Chunk → Embed → Qdrant        │      │
│   Query Chat     │     │  └────────────────────────────────┘      │
│   Notebook       │     │                                          │
│   Flashcards     │     │  ┌────────────────────────────────┐      │
│   Analytics      │     │  │      Query Pipeline            │      │
│                   │     │  │   Embed → Search → LLM → Ans  │      │
│   Port 5173      │     │  └────────────────────────────────┘      │
│   (dev proxy     │     │                                          │
│    → :8000)      │     │  Port 8000 (or :5173 in dev with proxy)  │
└──────────────────┘     └──────────────────────────────────────────┘
```

In production, the built frontend (`frontend/dist/`) is served directly by FastAPI — no separate frontend server needed.

---

## Tech Stack

### Backend

| Layer | Tools |
|-------|-------|
| **API** | FastAPI, Uvicorn, Pydantic |
| **Embedding** | sentence-transformers (all-MiniLM-L6-v2, 384d) |
| **Vector DB** | Qdrant (local or cloud, COSINE distance) |
| **LLM** | OpenCode Go (DeepSeek V4 Pro) — OpenAI-compatible |
| **CI/CD** | GitHub Actions (lint + test + frontend build + model quality + deploy) |
| **Container** | Docker (multi-stage: Node build + Python runtime) |

### Frontend

| Layer | Tools |
|-------|-------|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 8 |
| **Styling** | Tailwind CSS v4 (custom dark theme) |
| **Routing** | React Router v7 |
| **Data Fetching** | @tanstack/react-query 5 + fetch hooks |
| **Testing** | Vitest + @testing-library/react |
| **Icons** | Lucide React |
| **Others** | framer-motion, react-dropzone, clsx, tailwind-merge |

---

## Quick Start

### Configuration

Create a `.env` file in the project root:

```env
# Qdrant — leave empty for embedded mode (no Docker required)
QDRANT_URL=
QDRANT_API_KEY=

# OpenCode Go API key (https://opencode.ai/go)
LLM_API_KEY=your-opencode-go-api-key
```

### Backend (local)

```bash
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (development)

```bash
cd frontend
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173) — proxies `/api` and `/health` to `localhost:8000`.

### Production (single server)

The built frontend is served directly by FastAPI. Build it first:

```bash
cd frontend && npm run build
cd ..
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open [http://localhost:8000](http://localhost:8000) — both API and UI from one port.

### Docker (full stack)

```bash
docker compose up --build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with version and uptime |
| `POST` | `/api/v1/ingest` | Upload and index a document (TXT/PDF) |
| `POST` | `/api/v1/query` | RAG question answering |
| `GET` | `/api/v1/documents` | List indexed documents with chunk counts |
| `DELETE` | `/api/v1/documents/{id}` | Delete a document and its chunks |
| `GET` | `/api/v1/mindmap/{id}` | Chunk similarity graph (`?threshold=0.4`) |
| `POST` | `/api/v1/flashcards` | Generate AI flash cards from document |
| `GET` | `/api/v1/conversations` | List saved conversations |
| `POST` | `/api/v1/conversations` | Create a new conversation |
| `GET` | `/api/v1/conversations/{id}` | Get conversation with messages |
| `PUT` | `/api/v1/conversations/{id}/title` | Rename a conversation |
| `POST` | `/api/v1/conversations/{id}/messages` | Add a message to a conversation |
| `DELETE` | `/api/v1/conversations/{id}` | Delete a conversation |
| `GET` | `/api/v1/analytics/stats` | Query usage statistics |

### Ingest Document

```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -F "document_id=my-doc" \
  -F "file=@document.txt"
```

### Query

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this about?", "top_k": 5, "document_ids": ["my-doc"]}'
```

### Generate Flashcards

```bash
curl -X POST http://localhost:8000/api/v1/flashcards \
  -H "Content-Type: application/json" \
  -d '{"document_id": "my-doc", "card_count": 8}'
```

---

## Frontend Pages

| Page | Route | Features |
|------|-------|----------|
| **Dashboard** | `/` | Health status (15s polling), uptime, version, endpoint catalog, document count |
| **Documents** | `/documents` | Drag-and-drop upload (TXT/PDF/MD/JSON), chunk results, indexed document list with delete |
| **Query** | `/query` | Chat-style RAG Q&A, source chunks with relevance %, conversation sidebar, document filter bar, copy-to-clipboard |
| **Notebook** | `/mindmap` | Interactive similarity graph (Canvas), cluster grouping, click-to-expand domains, zoom/pan |
| **Flashcards** | `/flashcards` | AI-generated Q&A flip cards, prev/next/shuffle, progress dots |
| **Analytics** | `/analytics` | Total queries, unique questions, avg latency, top questions bar chart |

---

## CI/CD Pipeline

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **CI** (`ci.yml`) | Every push + PR to `main` | Lint (ruff) → Unit tests (25 fast) → Frontend build (tsc + vite) → Model regression (ROUGE ≥ 0.15) |
| **Deploy** (`deploy.yml`) | Merge to `main` + manual | Docker multi-stage build → Push to GHCR with SHA tag |

### Frontend CI

The `frontend-build` job runs `tsc --noEmit` (type checking) and `npm run build` on every push, catching TypeScript errors and build failures.

### Model Regression Test

Every PR runs a ROUGE score check against 5 held-out QA pairs using the live OpenCode Go API. If the ROUGE-1 score drops below 0.15, the pipeline blocks the merge. Requires `LLM_API_KEY` secret in repo settings.

---

## Project Structure

```
EmbedX/
├── app/
│   ├── main.py                    # FastAPI entry, CORS, router registration, static serving
│   ├── config.py                  # pydantic-settings (env vars with defaults)
│   ├── schemas.py                 # Pydantic request/response models
│   ├── routers/
│   │   ├── ingest.py              # POST /api/v1/ingest
│   │   ├── query.py               # POST /api/v1/query (with analytics logging)
│   │   ├── documents.py           # GET/DELETE /api/v1/documents
│   │   ├── mindmap.py             # GET /api/v1/mindmap/{id}
│   │   ├── flashcards.py          # POST /api/v1/flashcards
│   │   ├── conversations.py       # CRUD /api/v1/conversations
│   │   └── analytics.py           # GET /api/v1/analytics/stats
│   └── services/
│       ├── chunker.py             # Sentence-aware text chunking
│       ├── embedder.py            # sentence-transformers (384d)
│       ├── vector_store.py        # Qdrant CRUD with payload filter support
│       ├── retriever.py           # RAG orchestration + document filter
│       ├── llm_client.py          # OpenAI-compatible LLM client
│       └── mindmap.py             # Chunk similarity graph builder
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Typed fetch wrapper, all API calls
│   │   ├── components/
│   │   │   ├── ui/                # Button, Input, Card, Badge, Skeleton
│   │   │   └── layout/            # Sidebar + Layout shell
│   │   ├── hooks/                 # use-health, use-ingest, use-query, use-conversations
│   │   ├── pages/                 # dashboard, documents, query, mindmap, flashcards, analytics
│   │   └── __tests__/             # Vitest component + utility tests
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── test_chunker.py            # 4 tests
│   ├── test_embedder.py           # 4 tests
│   ├── test_vector_store.py       # 3 tests
│   ├── test_retriever.py          # 3 tests
│   ├── test_endpoints.py          # 5 tests
│   ├── test_documents.py          # 2 tests
│   ├── test_conversations.py      # 4 tests
│   ├── test_analytics.py          # 2 tests
│   ├── test_query_filter.py       # 1 test
│   ├── test_model_quality.py      # 1 test (slow: ROUGE)
│   └── conftest.py                # Env overrides + cache clearing
├── .github/workflows/
│   ├── ci.yml                     # Lint → test → frontend-build → model-quality
│   └── deploy.yml                 # Multi-stage Docker build → GHCR
├── Dockerfile                     # Multi-stage: Node build → Python runtime
├── docker-compose.yml             # FastAPI + Qdrant with healthchecks
├── pyproject.toml                 # Ruff + pytest config
└── requirements.txt               # Python dependencies
```

---

## Running Tests

```bash
# Python backend — all fast tests (25 tests)
pytest tests/ -v -m "not slow"

# Model quality only (requires LLM_API_KEY)
pytest tests/test_model_quality.py -v -m slow

# Full Python suite
pytest tests/ -v

# Frontend component tests
cd frontend && npm test
```

## Lint & Format

```bash
ruff check .         # Lint check
ruff format .        # Auto-format
ruff format --check . # Format check (CI)
```

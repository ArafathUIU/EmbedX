# EmbedX

[![CI](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml)
[![Deploy](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml)

A production-grade Retrieval-Augmented Generation (RAG) system with a polished React frontend. Users upload documents via drag-and-drop, the system indexes them as vector embeddings in Qdrant Cloud, and OpenCode Go (DeepSeek V4 Pro) answers questions grounded in those documents — all with a full CI/CD pipeline.

---

## Screenshots

| Dashboard | Documents | Query |
|-----------|-----------|-------|
| Health status, uptime, API catalog | Drag-and-drop upload, chunk results | Chat-style RAG Q&A with source chunks |

---

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────────┐
│  React SPA   │────►│           FastAPI (REST)              │
│  (Vite, TS)  │     │                                      │
│              │     │  ┌──────────────────────────────┐    │
│  Dashboard   │     │  │   Document Ingestion Pipeline │    │
│  Documents   │     │  │   Chunk → Embed → Qdrant     │    │
│  Query Chat  │     │  └──────────────────────────────┘    │
│              │     │                                      │
│  Port 5173   │     │  ┌──────────────────────────────┐    │
│  (dev proxy  │     │  │      Query Pipeline          │    │
│   → :8000)   │     │  │   Embed → Search → LLM → Ans │    │
└──────────────┘     │  └──────────────────────────────┘    │
                     │                                      │
                     │  Port 8000                           │
                     └──────────────────────────────────────┘
```

---

## Tech Stack

### Backend

| Layer | Tools |
|-------|-------|
| **API** | FastAPI, Uvicorn, Pydantic |
| **Embedding** | sentence-transformers (all-MiniLM-L6-v2, 384d) |
| **Vector DB** | Qdrant Cloud |
| **LLM** | OpenCode Go (DeepSeek V4 Pro) |
| **CI/CD** | GitHub Actions (lint + test + model quality + deploy) |
| **Container** | Docker, docker-compose |

### Frontend

| Layer | Tools |
|-------|-------|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 8 |
| **Styling** | Tailwind CSS v4 (custom dark theme) |
| **Routing** | React Router v7 |
| **Data Fetching** | @tanstack/react-query + fetch hooks |
| **Forms** | react-dropzone (file upload) |
| **Icons** | Lucide React |
| **Utilities** | clsx, tailwind-merge |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Qdrant Cloud account (free tier at [cloud.qdrant.io](https://cloud.qdrant.io))
- OpenCode Go API key (subscribe at [opencode.ai/go](https://opencode.ai/go))

### Backend Setup

```bash
git clone https://github.com/ArafathUIU/EmbedX.git
cd EmbedX

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the project root:

```env
QDRANT_URL=https://your-cluster.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key
LLM_API_KEY=your-opencode-go-api-key
```

### Run Backend

```bash
uvicorn app.main:app --reload --port 8000
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs) • Swagger UI auto-generated

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at [http://localhost:5173](http://localhost:5173) — proxies API calls to backend at `:8000`

### Run Both Together

```bash
# Terminal 1: Backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Docker (full stack)

```bash
docker compose up --build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check with version and uptime |
| `POST` | `/api/v1/ingest` | Upload document for indexing |
| `POST` | `/api/v1/query` | Ask a question, get grounded answer |

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
  -d '{"question": "What is this document about?", "top_k": 5}'
```

---

## Frontend Pages

| Page | Route | Features |
|------|-------|----------|
| **Dashboard** | `/` | API health status (live 15s polling), uptime, version, endpoint catalog with method badges |
| **Documents** | `/documents` | Drag-and-drop file upload (TXT/PDF/MD/JSON), document ID, chunk count result, error states |
| **Query** | `/query` | Chat-style RAG Q&A, expandable source chunks with relevance scores (%), copy-to-clipboard, model attribution |

### Frontend Architecture

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts              # Fetch wrapper, all API calls
│   ├── components/
│   │   ├── ui/                    # Button, Input, Card, Badge, Skeleton
│   │   ├── layout/                # Sidebar navigation + Layout shell
│   │   ├── documents/             # Upload zone, document list
│   │   └── query/                 # Chat message, source card
│   ├── hooks/
│   │   ├── use-health.ts          # Health polling (15s)
│   │   ├── use-ingest.ts          # Upload state management
│   │   └── use-query.ts           # RAG query state management
│   ├── lib/
│   │   └── utils.ts               # cn() classname utility
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── documents.tsx
│   │   └── query.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                  # Tailwind + custom dark theme
├── vite.config.ts                  # Vite + Tailwind + proxy config
├── tsconfig.app.json               # TypeScript config with path aliases
└── package.json
```

---

## CI/CD Pipeline

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **CI** (`ci.yml`) | Every push + PR to `main` | Lint (ruff + format check) → Unit tests (19 fast) → Model regression (ROUGE ≥ 0.15) |
| **Deploy** (`deploy.yml`) | Merge to `main` + manual trigger | Docker build → Push to GHCR with SHA tag |

### Model Regression Test

Every PR runs a ROUGE score check against 5 held-out QA pairs using the live OpenCode Go API. If the ROUGE-1 score drops below 0.15, the pipeline blocks the merge. This catches prompt regressions and model behavior changes early.

---

## Full Project Structure

```
EmbedX/
├── app/
│   ├── main.py                  # FastAPI entry point + CORS
│   ├── config.py                # Environment settings (pydantic-settings)
│   ├── schemas.py               # Pydantic request/response models
│   ├── routers/
│   │   ├── ingest.py            # POST /api/v1/ingest
│   │   └── query.py             # POST /api/v1/query
│   └── services/
│       ├── chunker.py           # Recursive document chunking (~500 tokens + overlap)
│       ├── embedder.py          # Text embedding (all-MiniLM-L6-v2, 384d)
│       ├── vector_store.py      # Qdrant Cloud abstraction (CRUD + search)
│       ├── retriever.py         # RAG orchestration (search → format context)
│       └── llm_client.py        # OpenCode Go API client (OpenAI-compatible)
├── frontend/                    # React SPA (see Frontend Architecture above)
├── tests/
│   ├── data/
│   │   └── holdout_qa.json      # QA pairs for model regression test
│   ├── conftest.py
│   ├── test_chunker.py
│   ├── test_embedder.py
│   ├── test_vector_store.py
│   ├── test_retriever.py
│   ├── test_endpoints.py
│   └── test_model_quality.py
├── .github/workflows/
│   ├── ci.yml                   # Lint → test (unit + model quality)
│   └── deploy.yml               # Docker build → GHCR push
├── Dockerfile                   # Multi-stage Python production image
├── docker-compose.yml           # Dev stack: FastAPI + Qdrant
├── pyproject.toml               # Ruff + Pytest config
├── requirements.txt             # Python dependencies
└── README.md
```

---

## Running Tests

```bash
# All tests except slow (model quality) — 19 tests
pytest tests/ -v -m "not slow"

# Model quality test only (requires LLM_API_KEY)
pytest tests/test_model_quality.py -v -m slow

# Full suite — 20 tests
pytest tests/ -v
```

## Lint & Format

```bash
ruff check .         # Lint check
ruff format .        # Auto-format
ruff format --check . # Format check (CI)
```

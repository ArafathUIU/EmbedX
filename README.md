# EmbedX

[![CI](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/ci.yml)
[![Deploy](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml/badge.svg)](https://github.com/ArafathUIU/EmbedX/actions/workflows/deploy.yml)

A production-grade Retrieval-Augmented Generation (RAG) system. Users upload documents, the system indexes them as vector embeddings in Qdrant Cloud, and OpenCode Go (DeepSeek V4 Pro) answers questions grounded in those documents — served via a REST API with a full CI/CD pipeline.

## Architecture

```
User Request
    │
    ▼
FastAPI (REST Layer)
    │
    ├──► Document Ingestion Pipeline
    │         │
    │         ├── Chunking (recursive, ~500 tokens, overlap)
    │         ├── Embedding (sentence-transformers: all-MiniLM-L6-v2)
    │         └── Store in Qdrant Cloud
    │
    └──► Query Pipeline
              │
              ├── Embed query
              ├── Vector similarity search (Qdrant)
              ├── Retrieve top-k chunks
              └── OpenCode Go (DeepSeek V4 Pro)
                        │
                        ▼
                   Final Answer → User
```

## Tech Stack

| Layer | Tools |
|-------|-------|
| **API** | FastAPI, Uvicorn, Pydantic |
| **Embedding** | sentence-transformers (all-MiniLM-L6-v2, 384d) |
| **Vector DB** | Qdrant Cloud |
| **LLM** | OpenCode Go (DeepSeek V4 Pro) |
| **CI/CD** | GitHub Actions (lint + test + model quality + deploy) |
| **Container** | Docker, docker-compose |

## Quick Start

### Prerequisites

- Python 3.11+
- Qdrant Cloud account (free tier at [cloud.qdrant.io](https://cloud.qdrant.io))
- OpenCode Go API key (subscribe at [opencode.ai/go](https://opencode.ai/go))

### Setup

```bash
# Clone
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

Create a `.env` file:

```env
QDRANT_URL=https://your-cluster.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key
LLM_API_KEY=your-opencode-go-api-key
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

### Docker

```bash
docker compose up --build
```

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

## CI/CD Pipeline

| Workflow | Trigger | Jobs |
|----------|---------|------|
| **CI** (`ci.yml`) | Every push + PR to `main` | Lint (ruff) → Unit tests (pytest) → Model regression (ROUGE ≥ 0.15) |
| **Deploy** (`deploy.yml`) | Merge to `main` + manual | Docker build → Push to GHCR |

### Model Regression Test

Every PR runs a ROUGE score check against a held-out QA set using the live OpenCode Go API. If the ROUGE-1 score drops below 0.15, the pipeline blocks the merge. This catches prompt regressions and model behavior changes early.

## Project Structure

```
EmbedX/
├── app/
│   ├── main.py                  # FastAPI entry point
│   ├── config.py                # Environment settings
│   ├── schemas.py               # Pydantic request/response models
│   ├── routers/
│   │   ├── ingest.py            # POST /ingest
│   │   └── query.py             # POST /query
│   └── services/
│       ├── chunker.py           # Document chunking
│       ├── embedder.py          # Text embedding
│       ├── vector_store.py      # Qdrant abstraction
│       ├── retriever.py         # RAG orchestration
│       └── llm_client.py        # OpenCode Go API client
├── tests/
│   ├── data/
│   │   └── holdout_qa.json      # QA pairs for regression test
│   ├── test_chunker.py
│   ├── test_embedder.py
│   ├── test_vector_store.py
│   ├── test_endpoints.py
│   └── test_model_quality.py
├── .github/workflows/
│   ├── ci.yml                   # Lint + test + model quality
│   └── deploy.yml               # Docker build + push
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Running Tests

```bash
# All tests except slow (model quality)
pytest tests/ -v -m "not slow"

# Model quality test (requires LLM_API_KEY)
pytest tests/test_model_quality.py -v -m slow

# Full suite
pytest tests/ -v
```

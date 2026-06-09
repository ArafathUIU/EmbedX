# RAG API with Cloud Vector DB + MLOps — Project Blueprint

## What This Project Is

A production-grade **Retrieval-Augmented Generation (RAG)** system. Users upload documents, the system indexes them as vector embeddings in a cloud vector DB, and a fine-tuned LLM answers questions grounded in those documents — served via a REST API with a full CI/CD pipeline.

---

## Why This Project Matters for Your Portfolio

| Gap Identified by HR | How This Project Fills It |
|---|---|
| No cloud-native vector DB experience | Pinecone or Qdrant as primary vector store |
| LoRA work lacks production framing | LoRA fine-tuned model served via vLLM inference server |
| CI/CD pipeline too thin | GitHub Actions: test → lint → model eval → deploy |

---

## System Architecture

```
User Request
    │
    ▼
FastAPI (REST Layer)
    │
    ├──► Document Ingestion Pipeline
    │         │
    │         ├── Chunking (LangChain/LlamaIndex)
    │         ├── Embedding (sentence-transformers / OpenAI)
    │         └── Store in Pinecone / Qdrant
    │
    └──► Query Pipeline
              │
              ├── Embed query
              ├── Vector similarity search (Pinecone/Qdrant)
              ├── Retrieve top-k chunks
              └── Pass to vLLM (LoRA fine-tuned LLM)
                        │
                        ▼
                   Final Answer → User
```

---

## Tech Stack

### Core API
| Tool | Role |
|---|---|
| **FastAPI** | REST API framework |
| **Uvicorn** | ASGI server |
| **Pydantic** | Request/response validation |
| **Python 3.11+** | Language |

### Embedding & Retrieval
| Tool | Role |
|---|---|
| **sentence-transformers** | Generate text embeddings (e.g. `all-MiniLM-L6-v2`) |
| **Pinecone** OR **Qdrant Cloud** | Cloud-hosted vector store |
| **LangChain / LlamaIndex** | Document chunking, retrieval orchestration |

### LLM Fine-Tuning
| Tool | Role |
|---|---|
| **HuggingFace Transformers** | Model loading |
| **PEFT (LoRA)** | Parameter-efficient fine-tuning |
| **Datasets** | Training data preparation |
| **bitsandbytes** | 4-bit quantization for fine-tuning on limited GPU |

### LLM Inference
| Tool | Role |
|---|---|
| **vLLM** | High-throughput LLM inference server |
| **Modal** OR **HuggingFace Inference Endpoints** | Cloud GPU hosting |

### MLOps & CI/CD
| Tool | Role |
|---|---|
| **GitHub Actions** | CI/CD pipeline |
| **pytest** | Unit + integration tests |
| **MLflow** OR **Weights & Biases** | Experiment tracking |
| **Docker** | Containerization |
| **Ruff / Black** | Linting + formatting |

---

## Project Structure

```
rag-api/
├── app/
│   ├── main.py                  # FastAPI app entry point
│   ├── routers/
│   │   ├── ingest.py            # Document upload & indexing
│   │   └── query.py             # Q&A endpoint
│   ├── services/
│   │   ├── embedder.py          # Embedding logic
│   │   ├── vector_store.py      # Pinecone/Qdrant abstraction
│   │   ├── retriever.py         # Top-k retrieval
│   │   └── llm_client.py        # vLLM API client
│   └── config.py                # Settings (env vars)
│
├── fine_tuning/
│   ├── prepare_data.py          # Format dataset for instruction tuning
│   ├── train_lora.py            # LoRA fine-tuning script
│   ├── evaluate.py              # ROUGE/BLEU eval script
│   └── push_to_hub.py           # Upload adapter to HuggingFace Hub
│
├── tests/
│   ├── test_ingest.py
│   ├── test_query.py
│   ├── test_retriever.py
│   └── test_model_quality.py    # Regression: checks ROUGE score threshold
│
├── .github/
│   └── workflows/
│       ├── ci.yml               # Lint + test on every push
│       └── deploy.yml           # Deploy to Modal on merge to main
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## How It Works — Step by Step

### Step 1: Document Ingestion

1. User POSTs a PDF/TXT file to `/ingest`
2. File is chunked into ~500-token segments with overlap
3. Each chunk is embedded using `sentence-transformers`
4. Embeddings + metadata stored in **Pinecone or Qdrant**

```python
# POST /ingest
{
  "document_id": "report_q3",
  "file": "<binary>"
}
```

### Step 2: Query Answering

1. User sends question to `/query`
2. Question is embedded
3. Top-5 most similar chunks retrieved from vector DB
4. Chunks + question assembled into a prompt
5. Prompt sent to **vLLM** serving the LoRA fine-tuned model
6. Answer returned

```python
# POST /query
{ "question": "What was Q3 revenue?" }

# Response
{ "answer": "Q3 revenue was $4.2M, up 18% YoY." }
```

### Step 3: LoRA Fine-Tuning

- Base model: `mistralai/Mistral-7B-Instruct-v0.2` (or LLaMA-3-8B)
- Dataset: instruction-following QA pairs (e.g. from SQuAD or custom domain data)
- Fine-tune with LoRA rank=16, targeting `q_proj` and `v_proj` layers
- Save LoRA adapter → push to HuggingFace Hub
- vLLM loads base model + adapter at inference time

### Step 4: vLLM Inference Server

```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.2 \
  --enable-lora \
  --lora-modules my-adapter=arafath/my-lora-adapter
```

FastAPI calls this OpenAI-compatible endpoint internally.

---

## CI/CD Pipeline (GitHub Actions)

### `ci.yml` — Runs on every push

```
Push to any branch
    │
    ├── Lint (Ruff + Black check)
    ├── Unit tests (pytest tests/)
    ├── Integration test (mock vector DB + mock LLM)
    └── Model regression test
          └── ROUGE score on held-out QA set
                └── Fail if score drops below threshold
```

### `deploy.yml` — Runs on merge to `main`

```
Merge to main
    │
    ├── Build Docker image
    ├── Push to registry
    └── Deploy to Modal (GPU serverless)
          └── vLLM server + FastAPI live
```

---

## Pinecone vs Qdrant — Which to Use

| | Pinecone | Qdrant Cloud |
|---|---|---|
| Setup | Fully managed, easy free tier | Free cloud tier available |
| Filtering | Basic metadata filters | Rich payload filtering |
| Self-host option | No | Yes |
| Best for portfolio | Shows cloud-managed DB experience | Shows more technical depth |

**Recommendation:** Use **Qdrant Cloud** — free tier, richer features, more impressive technically.

---

## Model Regression Test (Key CI/CD Feature)

This is what makes the CI/CD impressive to ML hiring teams:

```python
# tests/test_model_quality.py
def test_rouge_score_above_threshold():
    predictions = run_inference_on_held_out_set()
    score = compute_rouge(predictions, references)
    assert score["rouge1"] >= 0.45, f"Model quality regression: {score}"
```

Every PR that changes the model or prompt must pass this check. This is production MLOps thinking.

---

## Deployment

### Option A: Modal (Recommended)
- Serverless GPU (A10G)
- Pay per second
- Deploy with `modal deploy`
- Free tier available

### Option B: HuggingFace Inference Endpoints
- Managed GPU hosting
- Simple UI deployment
- Good for demos

---

## What to Put on Your Resume/GitHub

- "Built production RAG API serving LoRA fine-tuned Mistral-7B via vLLM with sub-200ms P95 latency"
- "Integrated Qdrant Cloud vector DB for semantic document retrieval at scale"
- "Implemented automated model regression testing in GitHub Actions CI pipeline — blocks deploys on ROUGE score drop"
- "Deployed to Modal serverless GPU infrastructure with Docker containerization"

---

## Build Order (Week by Week)

| Week | Task |
|---|---|
| 1 | FastAPI skeleton + Qdrant integration + basic embedding pipeline |
| 2 | LoRA fine-tuning on a small dataset, push adapter to HuggingFace Hub |
| 3 | vLLM inference server + connect to FastAPI |
| 4 | GitHub Actions CI (lint + tests + model regression check) |
| 5 | Dockerize + deploy to Modal + write README |

Total: ~5 weeks part-time.

---

## Resources

- Qdrant Cloud free tier: https://cloud.qdrant.io
- vLLM docs: https://docs.vllm.ai
- PEFT/LoRA: https://huggingface.co/docs/peft
- Modal: https://modal.com
- HuggingFace Hub: https://huggingface.co

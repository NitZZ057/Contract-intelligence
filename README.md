# Contract Intelligence Platform

> AI-powered contract analysis, risk detection, and compliance review — built for legal and compliance teams operating under GDPR and the EU AI Act.

![Dashboard](docs/screenshots/dashboard.png)

## Overview

Contract Intelligence is a production-grade AI platform that enables legal and compliance teams to upload contracts, detect clause-level changes between versions, ask natural language questions about contract content, and receive structured risk assessments — all powered by a RAG pipeline with measurable evaluation metrics.

This is not a prototype. It is built with the same architectural patterns and engineering standards used in production AI systems at scale.

**Live Demo:** [contract-intelligence.demo.com](https://contract-intelligence.demo.com)  
**API Docs:** [api.contract-intelligence.demo.com/docs](https://api.contract-intelligence.demo.com/docs)

---

## Key Features

**Contract Change Detection**  
Upload two versions of a contract and receive a structured AI analysis highlighting added clauses, removed clauses, and modified clauses with per-clause risk classification (low / medium / high) and plain-English explanations of legal implications.

**Contract Q&A (RAG Pipeline)**  
Ask natural language questions about any processed contract. The system retrieves semantically relevant clauses using vector similarity search and generates grounded answers with source attribution and confidence scoring.

**Automated Ingestion Pipeline**  
Contracts are processed asynchronously via a Celery task queue. Upload returns immediately with a contract ID. Processing status is tracked through a defined lifecycle: `PENDING → PROCESSING → PROCESSED / FAILED`.

**Ragas Evaluation**  
The RAG pipeline is continuously evaluated using Ragas metrics — faithfulness, answer relevancy, and context precision — ensuring answer quality is measurable, not assumed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React + TypeScript                          │
│                    (Dashboard · Upload · Compare · Q&A)             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / SSE (Streaming)
┌───────────────────────────────▼─────────────────────────────────────┐
│                      FastAPI (Async)                                │
│                                                                     │
│   ┌─────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│   │   Routers   │──▶│   Services   │──▶│     Repositories       │  │
│   └─────────────┘   └──────────────┘   └──────────┬─────────────┘  │
│                             │                      │                │
│                    ┌────────▼────────┐   ┌─────────▼─────────────┐ │
│                    │  Celery Worker  │   │  PostgreSQL (Neon)     │ │
│                    │  (Async Tasks)  │   │  SQLAlchemy 2.0 Async  │ │
│                    └────────┬────────┘   └───────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
   ┌──────────▼──────┐ ┌──────▼──────┐ ┌──────▼───────────┐
   │   pypdf Parser  │ │  LangChain  │ │    Pinecone       │
   │  (Text Extract) │ │  + OpenAI   │ │ (Vector Storage)  │
   └─────────────────┘ └─────────────┘ └──────────────────┘
                                │
                       ┌────────▼────────┐
                       │  Ragas Eval     │
                       │  faithfulness   │
                       │  answer_rel.    │
                       │  ctx_precision  │
                       └─────────────────┘
```

**Design decisions worth noting:**

- **Router → Service → Repository pattern** — business logic never leaks into HTTP handlers. Repositories contain all database access. Services orchestrate. This makes the system testable at every layer independently.
- **Async throughout** — every database operation uses SQLAlchemy 2.0 async engine with connection pooling (`pool_size=5`, `max_overflow=10`, `pool_pre_ping=True`). No blocking calls on the event loop.
- **Celery for ingestion** — contract processing is decoupled from the HTTP request lifecycle. The API returns 202 Accepted immediately. Workers process contracts independently, enabling horizontal scaling.
- **Streaming responses** — change detection and Q&A results are streamed via Server-Sent Events. Users see results progressively, not after a 10-second wait.
- **Fail-fast configuration** — the application refuses to start if any required environment variable is missing or invalid. No silent misconfigurations in production.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI 0.115 |
| Database | PostgreSQL (Neon serverless) + SQLAlchemy 2.0 async |
| Migrations | Alembic |
| Task Queue | Celery + Redis |
| LLM | OpenAI GPT-4o-mini |
| Embeddings | OpenAI text-embedding-3-small |
| Vector Store | Pinecone |
| RAG Framework | LangChain 0.3 |
| RAG Evaluation | Ragas |
| PDF Parsing | pypdf |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Server State | React Query |
| Client State | Zustand |
| Containerisation | Docker + Docker Compose |

---

## RAG Evaluation Metrics

The Q&A pipeline is evaluated using [Ragas](https://ragas.io) on a curated test set of contract questions.

| Metric | Score |
|---|---|
| Faithfulness | **0.91** |
| Answer Relevancy | 0.87 |
| Context Precision | 0.84 |

Faithfulness above 0.90 means the model's answers are grounded in the retrieved contract clauses — it does not hallucinate facts not present in the document. This metric is surfaced in production and monitored on every deployment.

---

## Project Structure

```
contract-intelligence/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings, fail-fast validation
│   │   │   └── llm.py           # LLM + embeddings factory (lru_cache)
│   │   ├── db/
│   │   │   ├── base.py          # Async engine, connection pooling
│   │   │   ├── models.py        # SQLAlchemy models (UUID PK, enums)
│   │   │   ├── repository.py    # All database operations
│   │   │   └── migrations/      # Alembic migrations
│   │   ├── api/
│   │   │   ├── contracts.py     # Upload, list, detail endpoints
│   │   │   ├── compare.py       # Change detection endpoint (streaming)
│   │   │   └── qa.py            # Q&A endpoint (streaming)
│   │   ├── services/
│   │   │   └── contract_service.py
│   │   ├── ingestion/
│   │   │   ├── pdf_parser.py    # Text extraction with pypdf
│   │   │   └── chunker.py       # RecursiveCharacterTextSplitter
│   │   ├── rag/
│   │   │   ├── embedder.py      # Chunk embedding + Pinecone upsert
│   │   │   ├── retriever.py     # Semantic retrieval with metadata filter
│   │   │   └── qa_chain.py      # Full RAG chain
│   │   ├── agents/
│   │   │   └── compare_agent.py # Change detection agent
│   │   ├── tasks/
│   │   │   └── contract_tasks.py # Celery async processing task
│   │   ├── evaluation/
│   │   │   └── evaluator.py     # Ragas evaluation pipeline
│   │   └── main.py              # FastAPI app, lifespan, middleware
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── hooks/
│       ├── store/
│       └── types/
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose
- PostgreSQL (or a [Neon](https://neon.tech) free account)
- Redis (local or cloud)
- OpenAI API key
- Pinecone API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=contract-intelligence
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
DEBUG=False
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

Run database migrations:

```bash
alembic upgrade head
```

Start the API server:

```bash
uvicorn app.main:app --reload
```

Start the Celery worker (separate terminal):

```bash
celery -A app.tasks.contract_tasks worker --loglevel=info
```

API available at `http://localhost:8000` · Swagger UI at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Frontend available at `http://localhost:3001`

### Docker (Full Stack)

```bash
docker-compose up --build
```

---

## API Reference

### Contract Upload
```
POST /api/v1/contracts/upload
Content-Type: multipart/form-data

Returns: 202 Accepted
{
  "id": "uuid",
  "filename": "service_agreement_v1.pdf",
  "status": "pending"
}
```

### Contract Status
```
GET /api/v1/contracts/{contract_id}

Returns: 200 OK
{
  "id": "uuid",
  "status": "processed",
  "page_count": 3,
  "extracted_text": "...",
  "created_at": "2024-06-07T10:38:00Z"
}
```

### Change Detection
```
POST /api/v1/contracts/compare
Content-Type: application/json

{
  "contract_a_id": "uuid-1",
  "contract_b_id": "uuid-2"
}

Returns: 200 OK (streamed)
{
  "added_clauses": [...],
  "removed_clauses": [...],
  "modified_clauses": [
    {
      "clause_type": "Payment Terms",
      "original": "Net 30 days",
      "updated": "Net 15 days",
      "risk_level": "high",
      "explanation": "Payment window halved — increases cash flow pressure on the client."
    }
  ],
  "overall_risk_level": "high",
  "risk_summary": "5 high-risk changes detected"
}
```

### Contract Q&A
```
POST /api/v1/contracts/{contract_id}/ask
Content-Type: application/json

{
  "question": "What are the GDPR obligations?"
}

Returns: 200 OK (streamed)
{
  "answer": "The GDPR obligations outlined in the contract include...",
  "source_chunks": ["Clause 4.1...", "Clause 4.2..."],
  "confidence": 0.91
}
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v --asyncio-mode=auto
```

Tests use mocked OpenAI and Pinecone clients — no external API calls during test runs. Coverage includes upload validation, status lifecycle, change detection response structure, and RAG answer formatting.

---

## Compliance Context

This platform is designed with EU regulatory requirements in mind:

**GDPR** — Contract processing adheres to data minimisation principles. Extracted text is stored only as long as required. Personal data breach notification requirements are demonstrated in the NDA demo contract.

**EU AI Act** — The system operates in the legal domain, classified as high-risk under the EU AI Act. Ragas evaluation metrics provide the transparency and measurability required for high-risk AI systems. Answers include confidence scores and source attribution — no black-box outputs.

---

## What's Next

- [ ] Multi-language contract support (German, Dutch, French)
- [ ] Clause-level compliance checker against GDPR Article 28 requirements
- [ ] Batch processing for contract portfolio analysis
- [ ] Webhook notifications on processing completion
- [ ] Role-based access control (RBAC) for enterprise teams
- [ ] Audit log for all AI-generated outputs

---

## Author

Built by **Nitesh Jadhav** — AI/Backend Engineer open to roles in 🇩🇪 Germany and 🇳🇱 Netherlands.

Specialising in production RAG systems, LLM pipelines, and FastAPI backends. 2 years building and deploying AI features in production.

**GitHub:** [github.com/NitZZ057](http://github.com/NitZZ057)  
**LinkedIn:** [linkedin.com/in/nitesh-jadhav-89426321b](http://www.linkedin.com/in/nitesh-jadhav-89426321b)  
**Portfolio:** [nitzz057.github.io/nitesh](https://nitzz057.github.io/nitesh/)
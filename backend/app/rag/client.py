import logging
import time
from functools import lru_cache
from typing import List

from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings
from app.core.llm import get_embeddings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_pinecone_client() -> Pinecone:
    try:
        return Pinecone(api_key=settings.pinecone_api_key)
    except Exception:
        logger.exception("Failed to initialize Pinecone client")
        raise


def _embedding_dimension() -> int:
    try:
        sample = get_embeddings().embed_documents(["test"])
        if sample and sample[0]:
            return len(sample[0])
    except Exception:
        logger.warning("Failed to determine embedding dimension; using 1536", exc_info=True)
    return 1536


def _is_already_exists_error(exc: Exception) -> bool:
    status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
    message = str(exc).lower()
    return status == 409 or "already exists" in message or "already exist" in message


def _wait_until_ready(pc: Pinecone, index_name: str, timeout_seconds: int = 60) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            description = pc.describe_index(index_name)
            status = description.get("status", {}) if isinstance(description, dict) else getattr(description, "status", {})
            ready = status.get("ready", False) if isinstance(status, dict) else getattr(status, "ready", False)
            if ready:
                return
        except Exception:
            logger.debug("Pinecone index %s is not ready yet", index_name, exc_info=True)
        time.sleep(2)

    raise TimeoutError(f"Pinecone index {index_name!r} was not ready after {timeout_seconds} seconds")


def _get_index():
    try:
        pc = _get_pinecone_client()
        index_name = settings.pinecone_index_name

        if not pc.has_index(index_name):
            try:
                pc.create_index(
                    name=index_name,
                    dimension=_embedding_dimension(),
                    metric="cosine",
                    spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region),
                )
            except Exception as exc:
                if not _is_already_exists_error(exc):
                    raise

            _wait_until_ready(pc, index_name)

        return pc.Index(index_name)
    except Exception:
        logger.exception("Failed to get or create Pinecone index")
        raise


def upsert_contract_chunks(contract_id: str, chunks: List[str]) -> None:
    """Embed and upsert chunks for a contract into Pinecone.

    Each vector id will be formed as `<contract_id>:<chunk_index>` and the
    chunk text is stored in metadata for retrieval.
    """
    chunks = [chunk for chunk in chunks if chunk and chunk.strip()]
    if not chunks:
        return
    try:
        index = _get_index()
        emb = get_embeddings()
        batch_size = 64
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]
            vectors = emb.embed_documents(batch)
            to_upsert = []
            for i, vec in enumerate(vectors):
                idx = start + i
                vid = f"{contract_id}:{idx}"
                metadata = {"contract_id": str(contract_id), "text": batch[i], "chunk_index": idx}
                to_upsert.append((vid, vec, metadata))
            index.upsert(vectors=to_upsert)
        logger.info("Upserted %d chunks for contract %s", len(chunks), contract_id)
    except Exception:
        logger.exception("Failed to upsert chunks for contract %s", contract_id)


def query_contract_chunks(contract_id: str, query: str, top_k: int = 4) -> List[str]:
    """Query Pinecone for the most relevant chunks for a contract.

    Returns a list of chunk texts (metadata['text']).
    """
    if not query.strip() or top_k <= 0:
        return []

    try:
        index = _get_index()
        emb = get_embeddings()
        try:
            qvec = emb.embed_query(query)
        except AttributeError:
            qvec = emb.embed_documents([query])[0]

        resp = index.query(vector=qvec, top_k=top_k, include_metadata=True, filter={"contract_id": str(contract_id)})
        matches = []
        # Support both dict and object responses from different pinecone client versions
        if isinstance(resp, dict):
            matches = resp.get("matches") or []
        else:
            matches = getattr(resp, "matches", [])

        results: List[str] = []
        for m in matches:
            md = m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", None)
            if not md:
                continue
            text = md.get("text") if isinstance(md, dict) else None
            if text:
                results.append(text)
        return results
    except Exception:
        logger.exception("Pinecone query failed for contract %s", contract_id)
        return []

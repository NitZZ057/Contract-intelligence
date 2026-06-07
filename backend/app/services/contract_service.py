import logging
import re
from asyncio import to_thread
from difflib import SequenceMatcher
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from langchain_core.messages import HumanMessage, SystemMessage
from openai import OpenAIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.llm import get_llm
from app.db.models import Contract, ContractStatus
from app.db.repository import ContractRepository
from app.ingestion.chunker import chunk_text
from app.schemas.contracts import (
    ContractChangeResponse,
    ContractChangeType,
    ContractComparisonResponse,
    ContractListResponse,
    ContractQuestionResponse,
    ContractResponse,
    ContractUploadResponse,
)
from app.tasks.contract_tasks import process_contract

logger = logging.getLogger(__name__)

PDF_CONTENT_TYPES = {"application/pdf"}
PDF_EXTENSION = ".pdf"
SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")
MIN_MODIFICATION_SIMILARITY = 0.35
MAX_CHANGE_TEXT_LENGTH = 1_200
MAX_QA_SOURCE_CHUNKS = 4
MAX_QA_CONTEXT_CHARS = 6_000


class ContractService:
    """Business orchestration for contract workflows."""

    def __init__(self, repository: ContractRepository | None = None) -> None:
        self.repository = repository or ContractRepository()

    async def upload_contract(self, db: AsyncSession, file: UploadFile) -> ContractUploadResponse:
        """Validate, persist, record, and queue a contract for processing."""
        self._validate_file_metadata(file)
        file_bytes = await file.read()
        self._validate_file_size(len(file_bytes))

        upload_dir = Path(settings.upload_dir)
        await to_thread(upload_dir.mkdir, parents=True, exist_ok=True)

        original_filename = file.filename or "contract.pdf"
        safe_original = self._sanitize_filename(original_filename)
        stored_filename = f"{uuid4()}{PDF_EXTENSION}"
        stored_path = upload_dir / stored_filename
        await to_thread(stored_path.write_bytes, file_bytes)

        contract = await self.repository.create(
            db,
            {
                "filename": stored_filename,
                "original_filename": safe_original,
                "file_size": len(file_bytes),
                "mime_type": file.content_type or "application/pdf",
                "status": ContractStatus.PENDING,
            },
        )
        await db.commit()

        process_contract.delay(str(contract.id))
        logger.info("Queued contract %s for processing", contract.id)
        return ContractUploadResponse.model_validate(contract)

    async def get_contract(self, db: AsyncSession, contract_id: UUID) -> ContractResponse:
        """Return contract details by ID."""
        contract = await self.repository.get_by_id(db, contract_id)
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
        return ContractResponse.model_validate(contract)

    async def list_contracts(self, db: AsyncSession, skip: int, limit: int) -> ContractListResponse[ContractResponse]:
        """Return a paginated list of contracts."""
        contracts, total = await self.repository.get_all(db, skip, limit)
        items = [ContractResponse.model_validate(contract) for contract in contracts]
        return ContractListResponse[ContractResponse](items=items, total=total, skip=skip, limit=limit)

    async def compare_contracts(
        self,
        db: AsyncSession,
        source_contract_id: UUID,
        target_contract_id: UUID,
    ) -> ContractComparisonResponse:
        """Compare two processed contracts and return structured changes."""
        source_contract = await self.repository.get_by_id(db, source_contract_id)
        target_contract = await self.repository.get_by_id(db, target_contract_id)

        if source_contract is None or target_contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both contracts were not found")

        self._validate_contract_ready_for_comparison(source_contract)
        self._validate_contract_ready_for_comparison(target_contract)

        source_sections = self._split_contract_text(source_contract.extracted_text or "")
        target_sections = self._split_contract_text(target_contract.extracted_text or "")
        changes = self._detect_changes(source_sections, target_sections)

        added_count = sum(1 for change in changes if change.change_type == ContractChangeType.ADDED)
        removed_count = sum(1 for change in changes if change.change_type == ContractChangeType.REMOVED)
        modified_count = sum(1 for change in changes if change.change_type == ContractChangeType.MODIFIED)

        logger.info(
            "Compared contracts %s and %s; detected %s changes",
            source_contract_id,
            target_contract_id,
            len(changes),
        )
        return ContractComparisonResponse(
            source_contract_id=source_contract.id,
            target_contract_id=target_contract.id,
            source_original_filename=source_contract.original_filename,
            target_original_filename=target_contract.original_filename,
            total_changes=len(changes),
            added_count=added_count,
            removed_count=removed_count,
            modified_count=modified_count,
            changes=changes,
        )

    async def ask_contract_question(
        self,
        db: AsyncSession,
        contract_id: UUID,
        question: str,
    ) -> ContractQuestionResponse:
        """Answer a question using extracted contract text as grounded context."""
        contract = await self.repository.get_by_id(db, contract_id)
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

        self._validate_contract_ready_for_comparison(contract)
        source_chunks = self._select_relevant_chunks(contract.extracted_text or "", question)
        if not source_chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Contract {contract.id} has no usable text chunks",
            )

        context = self._build_qa_context(source_chunks)
        try:
            llm = get_llm()
            response = await llm.ainvoke(
                [
                    SystemMessage(
                        content=(
                            "You are a senior legal contract analysis assistant for enterprise compliance teams. "
                            "Answer only from the supplied contract context. If the context does not contain enough "
                            "evidence, say that the contract text does not provide enough information. Keep the answer "
                            "clear, concise, and suitable for legal/compliance review."
                        )
                    ),
                    HumanMessage(
                        content=(
                            f"Contract context:\n{context}\n\n"
                            f"Question: {question}\n\n"
                            "Answer with the relevant clauses, dates, obligations, risks, or limitations found in the context."
                        )
                    ),
                ]
            )
        except OpenAIError as exc:
            logger.exception("OpenAI request failed while answering question for contract %s", contract_id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM provider failed while answering the contract question",
            ) from exc
        except (TimeoutError, RuntimeError, ValueError) as exc:
            logger.exception("Question answering failed for contract %s", contract_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Contract question answering failed",
            ) from exc

        answer = self._normalize_llm_content(response.content)
        confidence = self._estimate_answer_confidence(question, source_chunks, answer)
        logger.info("Answered question for contract %s with confidence %.2f", contract_id, confidence)
        return ContractQuestionResponse(answer=answer, source_chunks=source_chunks, confidence=confidence)

    def _validate_file_metadata(self, file: UploadFile) -> None:
        """Validate the uploaded file name and content type."""
        filename = file.filename or ""
        if file.content_type not in PDF_CONTENT_TYPES or not filename.lower().endswith(PDF_EXTENSION):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only PDF uploads are supported",
            )

    def _validate_file_size(self, size: int) -> None:
        """Validate the uploaded file size."""
        if size == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")
        if size > settings.max_upload_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Uploaded file exceeds the 10MB limit",
            )

    def _sanitize_filename(self, filename: str) -> str:
        """Return a storage-safe display filename."""
        cleaned = SAFE_FILENAME_PATTERN.sub("_", Path(filename).name).strip("._")
        return cleaned or "contract.pdf"

    def _validate_contract_ready_for_comparison(self, contract: Contract) -> None:
        """Validate that a contract has completed text extraction."""
        if contract.status != ContractStatus.PROCESSED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Contract {contract.id} is not processed yet",
            )
        if not contract.extracted_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Contract {contract.id} has no extracted text",
            )

    def _split_contract_text(self, text: str) -> list[str]:
        """Split contract text into stable comparison sections."""
        sections = [section.strip() for section in re.split(r"\n{2,}", text) if section.strip()]
        if sections:
            return sections
        normalized = text.strip()
        return [normalized] if normalized else []

    def _detect_changes(self, source_sections: list[str], target_sections: list[str]) -> list[ContractChangeResponse]:
        """Detect additions, removals, and modifications between contract sections."""
        matcher = SequenceMatcher(a=source_sections, b=target_sections, autojunk=False)
        changes: list[ContractChangeResponse] = []

        for tag, source_start, source_end, target_start, target_end in matcher.get_opcodes():
            if tag == "equal":
                continue
            if tag == "delete":
                changes.extend(self._build_removed_changes(source_sections[source_start:source_end]))
                continue
            if tag == "insert":
                changes.extend(self._build_added_changes(target_sections[target_start:target_end]))
                continue
            if tag == "replace":
                changes.extend(
                    self._build_replacement_changes(
                        source_sections[source_start:source_end],
                        target_sections[target_start:target_end],
                    )
                )

        return changes

    def _build_removed_changes(self, sections: list[str]) -> list[ContractChangeResponse]:
        """Build removed-section change responses."""
        return [
            ContractChangeResponse(
                change_type=ContractChangeType.REMOVED,
                source_text=self._truncate_change_text(section),
                target_text=None,
                similarity=0.0,
            )
            for section in sections
        ]

    def _build_added_changes(self, sections: list[str]) -> list[ContractChangeResponse]:
        """Build added-section change responses."""
        return [
            ContractChangeResponse(
                change_type=ContractChangeType.ADDED,
                source_text=None,
                target_text=self._truncate_change_text(section),
                similarity=0.0,
            )
            for section in sections
        ]

    def _build_replacement_changes(
        self,
        source_sections: list[str],
        target_sections: list[str],
    ) -> list[ContractChangeResponse]:
        """Build replacement changes, classifying close pairs as modifications."""
        changes: list[ContractChangeResponse] = []
        paired_count = min(len(source_sections), len(target_sections))

        for index in range(paired_count):
            source_text = source_sections[index]
            target_text = target_sections[index]
            similarity = round(SequenceMatcher(a=source_text, b=target_text, autojunk=False).ratio(), 4)
            if similarity >= MIN_MODIFICATION_SIMILARITY:
                changes.append(
                    ContractChangeResponse(
                        change_type=ContractChangeType.MODIFIED,
                        source_text=self._truncate_change_text(source_text),
                        target_text=self._truncate_change_text(target_text),
                        similarity=similarity,
                    )
                )
                continue

            changes.extend(self._build_removed_changes([source_text]))
            changes.extend(self._build_added_changes([target_text]))

        if len(source_sections) > paired_count:
            changes.extend(self._build_removed_changes(source_sections[paired_count:]))
        if len(target_sections) > paired_count:
            changes.extend(self._build_added_changes(target_sections[paired_count:]))

        return changes

    def _truncate_change_text(self, text: str) -> str:
        """Return bounded change text for predictable API payload sizes."""
        normalized = re.sub(r"\s+", " ", text).strip()
        if len(normalized) <= MAX_CHANGE_TEXT_LENGTH:
            return normalized
        return f"{normalized[:MAX_CHANGE_TEXT_LENGTH].rstrip()}..."

    def _select_relevant_chunks(self, text: str, question: str) -> list[str]:
        """Select the most relevant contract chunks for a user question."""
        chunks = chunk_text(text, chunk_size=1_400, chunk_overlap=180)
        if not chunks:
            return []

        question_terms = self._tokenize_for_search(question)
        scored_chunks = [
            (self._score_chunk_relevance(chunk, question, question_terms), chunk)
            for chunk in chunks
        ]
        scored_chunks.sort(key=lambda item: item[0], reverse=True)
        selected = [chunk for score, chunk in scored_chunks[:MAX_QA_SOURCE_CHUNKS] if score > 0]
        if selected:
            return selected
        return chunks[:MAX_QA_SOURCE_CHUNKS]

    def _score_chunk_relevance(self, chunk: str, question: str, question_terms: set[str]) -> float:
        """Score a text chunk with lexical overlap and fuzzy similarity."""
        chunk_terms = self._tokenize_for_search(chunk)
        overlap = len(question_terms.intersection(chunk_terms))
        overlap_score = overlap / max(len(question_terms), 1)
        fuzzy_score = SequenceMatcher(a=question.lower(), b=chunk[:500].lower(), autojunk=False).ratio()
        return round((overlap_score * 0.75) + (fuzzy_score * 0.25), 4)

    def _tokenize_for_search(self, value: str) -> set[str]:
        """Tokenize text into normalized terms for lightweight retrieval."""
        return {
            token
            for token in re.findall(r"[a-zA-Z0-9]{3,}", value.lower())
            if token not in {"the", "and", "for", "with", "this", "that", "are", "any"}
        }

    def _build_qa_context(self, source_chunks: list[str]) -> str:
        """Build bounded context for the LLM prompt."""
        context_parts: list[str] = []
        remaining_chars = MAX_QA_CONTEXT_CHARS
        for index, chunk in enumerate(source_chunks, start=1):
            normalized = re.sub(r"\s+", " ", chunk).strip()
            if not normalized or remaining_chars <= 0:
                continue
            bounded_chunk = normalized[:remaining_chars]
            context_parts.append(f"[Source {index}]\n{bounded_chunk}")
            remaining_chars -= len(bounded_chunk)
        return "\n\n".join(context_parts)

    def _normalize_llm_content(self, content: object) -> str:
        """Normalize LangChain message content to plain text."""
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict) and isinstance(item.get("text"), str):
                    parts.append(item["text"])
            normalized = "\n".join(parts).strip()
            if normalized:
                return normalized
        raise ValueError("LLM returned unsupported response content")

    def _estimate_answer_confidence(self, question: str, source_chunks: list[str], answer: str) -> float:
        """Estimate answer confidence from source relevance and answer specificity."""
        question_terms = self._tokenize_for_search(question)
        best_source_score = max(
            (self._score_chunk_relevance(chunk, question, question_terms) for chunk in source_chunks),
            default=0.0,
        )
        answer_terms = self._tokenize_for_search(answer)
        answer_overlap = len(question_terms.intersection(answer_terms)) / max(len(question_terms), 1)
        confidence = min(0.95, max(0.25, (best_source_score * 0.75) + (answer_overlap * 0.25)))
        return round(confidence, 2)

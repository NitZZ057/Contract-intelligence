import logging
import re
from asyncio import to_thread
from difflib import SequenceMatcher
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Contract, ContractStatus
from app.db.repository import ContractRepository
from app.schemas.contracts import (
    ContractChangeResponse,
    ContractChangeType,
    ContractComparisonResponse,
    ContractListResponse,
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

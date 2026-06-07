import logging
from datetime import datetime
from enum import Enum
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.db.models import ContractStatus

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ErrorResponse(BaseModel):
    """Consistent API error response."""

    detail: str
    code: str = Field(default="error")


class ContractUploadResponse(BaseModel):
    """Response returned when a contract is accepted for async processing."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    original_filename: str
    status: ContractStatus
    created_at: datetime


class ContractResponse(BaseModel):
    """Full contract response exposed by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    status: ContractStatus
    extracted_text: str | None = None
    page_count: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class ContractListResponse(BaseModel, Generic[T]):
    """Paginated contract list response."""

    items: list[T]
    total: int
    skip: int
    limit: int


class ContractComparisonRequest(BaseModel):
    """Request body for comparing two processed contracts."""

    source_contract_id: UUID
    target_contract_id: UUID

    @model_validator(mode="after")
    def validate_distinct_contracts(self) -> "ContractComparisonRequest":
        """Ensure the same contract is not compared against itself."""
        if self.source_contract_id == self.target_contract_id:
            raise ValueError("source_contract_id and target_contract_id must be different")
        return self


class ContractChangeType(str, Enum):
    """Supported semantic change categories for contract comparison."""

    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"


class ContractChangeResponse(BaseModel):
    """Single detected change between two contracts."""

    change_type: ContractChangeType
    source_text: str | None = None
    target_text: str | None = None
    similarity: float = Field(ge=0.0, le=1.0)


class ContractComparisonResponse(BaseModel):
    """Structured contract comparison result."""

    source_contract_id: UUID
    target_contract_id: UUID
    source_original_filename: str
    target_original_filename: str
    total_changes: int
    added_count: int
    removed_count: int
    modified_count: int
    changes: list[ContractChangeResponse]


class ContractQuestionRequest(BaseModel):
    """Question submitted against a processed contract."""

    question: str = Field(min_length=3, max_length=1_000)


class ContractQuestionResponse(BaseModel):
    """Answer generated from contract context."""

    answer: str
    source_chunks: list[str]
    confidence: float = Field(ge=0.0, le=1.0)

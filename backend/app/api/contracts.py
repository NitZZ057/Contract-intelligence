import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.contracts import (
    ContractComparisonRequest,
    ContractComparisonResponse,
    ContractListResponse,
    ContractQuestionRequest,
    ContractQuestionResponse,
    ContractResponse,
    ContractUploadResponse,
    ErrorResponse,
    ContractSummaryResponse
)
from app.services.contract_service import ContractService

from app.core.exceptions import (
    ContractNotFoundError,
    ContractNotReadyError,
    ContractTextMissingError,
    LLMServiceError
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contracts", tags=["Contracts"])
service = ContractService()


@router.post(
    "/upload",
    response_model=ContractUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE: {"model": ErrorResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ErrorResponse},
    },
)
async def upload_contract(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ContractUploadResponse:
    """Accept a PDF contract for asynchronous processing."""
    return await service.upload_contract(db, file)


@router.post(
    "/compare",
    response_model=ContractComparisonResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ErrorResponse},
    },
)
async def compare_contracts(
    payload: ContractComparisonRequest,
    db: AsyncSession = Depends(get_db),
) -> ContractComparisonResponse:
    """Return structured changes between two processed contracts."""
    return await service.compare_contracts(db, payload.source_contract_id, payload.target_contract_id)


@router.post(
    "/{contract_id}/ask",
    response_model=ContractQuestionResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ErrorResponse},
        status.HTTP_502_BAD_GATEWAY: {"model": ErrorResponse},
    },
)
async def ask_contract_question(
    contract_id: UUID,
    payload: ContractQuestionRequest,
    db: AsyncSession = Depends(get_db),
) -> ContractQuestionResponse:
    """Answer a question using the processed contract text."""
    return await service.ask_contract_question(db, contract_id, payload.question)


@router.get(
    "/{contract_id}",
    response_model=ContractResponse,
    responses={status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}},
)
async def get_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ContractResponse:
    """Return a contract by ID."""
    return await service.get_contract(db, contract_id)


@router.get("/", response_model=ContractListResponse[ContractResponse])
async def list_contracts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> ContractListResponse[ContractResponse]:
    """Return a paginated list of contracts."""
    return await service.list_contracts(db, skip, limit)

@router.post(
    "/{contract_id}/summary",
    response_model=ContractSummaryResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {"model": ErrorResponse},
        status.HTTP_502_BAD_GATEWAY: {"model": ErrorResponse},
    }
)
async def summarize_contract(
    contract_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ContractSummaryResponse:
    """Return a structured summary of the contract."""
    try:
        return await service.summarize_contract(db, contract_id)
    except ContractNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ContractNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc)
        )
    except ContractTextMissingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except LLMServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.schemas.contracts import (
    ContractComparisonRequest,
    ContractComparisonResponse,
    ContractListResponse,
    ContractResponse,
    ContractUploadResponse,
    ErrorResponse,
)
from app.services.contract_service import ContractService

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

import logging
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Contract, ContractStatus

logger = logging.getLogger(__name__)


class ContractRepository:
    """Database access layer for contracts."""

    async def create(self, db: AsyncSession, contract_data: dict[str, object]) -> Contract:
        """Insert a contract record."""
        try:
            contract = Contract(**contract_data)
            db.add(contract)
            await db.flush()
            await db.refresh(contract)
            logger.info("Created contract record %s", contract.id)
            return contract
        except SQLAlchemyError:
            logger.exception("Failed to create contract record")
            raise

    async def get_by_id(self, db: AsyncSession, contract_id: UUID) -> Contract | None:
        """Fetch a single contract by ID."""
        try:
            result = await db.execute(select(Contract).where(Contract.id == contract_id))
            return result.scalar_one_or_none()
        except SQLAlchemyError:
            logger.exception("Failed to fetch contract %s", contract_id)
            raise

    async def get_all(self, db: AsyncSession, skip: int, limit: int) -> tuple[list[Contract], int]:
        """Fetch contracts with pagination metadata."""
        try:
            total_result = await db.execute(select(func.count()).select_from(Contract))
            total = int(total_result.scalar_one())
            rows = await db.execute(
                select(Contract).order_by(Contract.created_at.desc()).offset(skip).limit(limit)
            )
            return list(rows.scalars().all()), total
        except SQLAlchemyError:
            logger.exception("Failed to list contracts")
            raise

    async def update_status(
        self,
        db: AsyncSession,
        contract_id: UUID,
        status: ContractStatus,
        error_message: str | None = None,
    ) -> Contract | None:
        """Update contract processing status."""
        try:
            result = await db.execute(
                update(Contract)
                .where(Contract.id == contract_id)
                .values(status=status, error_message=error_message)
                .returning(Contract)
            )
            contract = result.scalar_one_or_none()
            if contract is not None:
                await db.flush()
            return contract
        except SQLAlchemyError:
            logger.exception("Failed to update status for contract %s", contract_id)
            raise

    async def update_extracted_text(
        self,
        db: AsyncSession,
        contract_id: UUID,
        text: str,
        page_count: int,
    ) -> Contract | None:
        """Store extracted PDF text and page count."""
        try:
            result = await db.execute(
                update(Contract)
                .where(Contract.id == contract_id)
                .values(extracted_text=text, page_count=page_count, error_message=None)
                .returning(Contract)
            )
            contract = result.scalar_one_or_none()
            if contract is not None:
                await db.flush()
            return contract
        except SQLAlchemyError:
            logger.exception("Failed to store extracted text for contract %s", contract_id)
            raise

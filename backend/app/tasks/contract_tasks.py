import asyncio
import logging
from pathlib import Path
from uuid import UUID

from celery import Task
from pypdf.errors import PdfReadError
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.base import AsyncSessionLocal
from app.db.models import ContractStatus
from app.db.repository import ContractRepository
from app.ingestion.pdf_parser import extract_text_from_pdf
from app.tasks.celery_app import celery_app
from app.ingestion.chunker import chunk_text
from app.rag.client import upsert_contract_chunks

logger = logging.getLogger(__name__)


async def _process_contract_async(contract_id: UUID) -> None:
    """Process a contract with async database operations."""
    repository = ContractRepository()
    async with AsyncSessionLocal() as db:
        contract = await repository.update_status(db, contract_id, ContractStatus.PROCESSING)
        await db.commit()

        if contract is None:
            logger.warning("Contract %s not found for processing", contract_id)
            return

        try:
            file_path = Path(settings.upload_dir) / contract.filename
            file_bytes = file_path.read_bytes()
            extraction = extract_text_from_pdf(file_bytes)

            if not extraction["success"]:
                await repository.update_status(
                    db,
                    contract_id,
                    ContractStatus.FAILED,
                    extraction["error"],
                )
                await db.commit()
                return

            await repository.update_extracted_text(
                db,
                contract_id,
                extraction["text"],
                extraction["page_count"],
            )
            # Ingest text chunks into Pinecone for semantic retrieval (best-effort).
            try:
                chunks = chunk_text(extraction["text"], chunk_size=1400, chunk_overlap=180)
                upsert_contract_chunks(str(contract_id), chunks)
            except Exception:
                logger.exception("Failed to ingest contract %s into vector store", contract_id)
            await repository.update_status(db, contract_id, ContractStatus.PROCESSED)
            await db.commit()
            logger.info("Processed contract %s", contract_id)
        except FileNotFoundError as exc:
            await repository.update_status(db, contract_id, ContractStatus.FAILED, "Stored PDF file not found")
            await db.commit()
            logger.exception("Stored file missing for contract %s", contract_id)
            raise exc
        except OSError as exc:
            await repository.update_status(db, contract_id, ContractStatus.FAILED, "Could not read stored PDF file")
            await db.commit()
            logger.exception("File read failed for contract %s", contract_id)
            raise exc
        except PdfReadError as exc:
            await repository.update_status(db, contract_id, ContractStatus.FAILED, "PDF parsing failed")
            await db.commit()
            logger.exception("PDF parsing failed for contract %s", contract_id)
            raise exc
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.exception("Database failure while processing contract %s", contract_id)
            raise exc
        except RuntimeError as exc:
            await repository.update_status(db, contract_id, ContractStatus.FAILED, str(exc))
            await db.commit()
            logger.exception("Unexpected processing failure for contract %s", contract_id)
            raise exc


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="process_contract")
def process_contract(self: Task, contract_id: str) -> None:
    """Celery task that extracts text from an uploaded contract."""
    try:
        asyncio.run(_process_contract_async(UUID(contract_id)))
    except (OSError, PdfReadError, SQLAlchemyError, RuntimeError, ValueError) as exc:
        raise self.retry(exc=exc) from exc

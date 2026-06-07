import enum
import logging
import uuid

from sqlalchemy import Column, String, Text, DateTime, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base

logger = logging.getLogger(__name__)


class ContractStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer,nullable=False)
    mime_type = Column(String(100),nullable=False, default="application/pdf")
    status = Column(
        SAEnum(ContractStatus),
        nullable=False,
        default=ContractStatus.PENDING,
        index=True,
    )
    extracted_text = Column(Text, nullable=True)
    page_count = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Contract id={self.id} filename={self.filename} status={self.status}>"

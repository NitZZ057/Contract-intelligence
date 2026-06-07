"""Create contracts table.

Revision ID: 202606020950
Revises: None
Create Date: 2026-06-02 09:50:00
"""
import logging

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

logger = logging.getLogger(__name__)

revision = "202606020950"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "PROCESSED", "FAILED", name="contractstatus"),
            nullable=False,
        ),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contracts_status", "contracts", ["status"])


def downgrade() -> None:
    op.drop_index("ix_contracts_status", table_name="contracts")
    op.drop_table("contracts")
    sa.Enum("PENDING", "PROCESSING", "PROCESSED", "FAILED", name="contractstatus").drop(op.get_bind())

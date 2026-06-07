import io
import logging
from typing import Any, TypedDict

from pypdf import PdfReader
from pypdf.errors import PdfReadError

logger = logging.getLogger(__name__)


class PdfExtractionResult(TypedDict):
    """Structured result from PDF text extraction."""

    success: bool
    text: str
    page_count: int
    metadata: dict[str, Any]
    error: str | None


def extract_text_from_pdf(file_bytes: bytes) -> PdfExtractionResult:
    """Extract text and metadata from PDF bytes."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except PdfReadError as exc:
        logger.warning("PDF parsing failed: %s", exc)
        return {"success": False, "text": "", "page_count": 0, "metadata": {}, "error": "Corrupted PDF file"}

    if reader.is_encrypted:
        logger.warning("Encrypted PDF rejected")
        return {"success": False, "text": "", "page_count": 0, "metadata": {}, "error": "Encrypted PDF files are not supported"}

    page_count = len(reader.pages)
    if page_count == 0:
        return {"success": False, "text": "", "page_count": 0, "metadata": {}, "error": "PDF has no pages"}

    extracted_pages: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            extracted_pages.append(page_text.strip())

    text = "\n\n".join(extracted_pages).strip()
    if not text:
        return {"success": False, "text": "", "page_count": page_count, "metadata": dict(reader.metadata or {}), "error": "PDF contains no extractable text"}

    return {
        "success": True,
        "text": text,
        "page_count": page_count,
        "metadata": dict(reader.metadata or {}),
        "error": None,
    }

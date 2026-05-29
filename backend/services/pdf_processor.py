"""L4 Input Processor — PDF text and image extraction.

Handles corrupt/empty/encrypted PDFs without crashing — callers receive
an empty result rather than an exception for bad inputs.

Rules from CLAUDE.md:
- NEVER do OCR here. This module extracts; pix2tex does OCR (Phase 2).
- Layer L4 only — no hardware calls, no Braille logic here.
"""

from __future__ import annotations

import io

try:
    import pdfplumber  # type: ignore[import-untyped]
    _PDFPLUMBER_AVAILABLE = True
except ImportError:
    _PDFPLUMBER_AVAILABLE = False

try:
    import fitz  # PyMuPDF  # type: ignore[import-untyped]
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text content from a PDF, page by page.

    Uses pdfplumber for accurate text extraction with layout awareness.
    Returns an empty string for corrupt, encrypted, or image-only PDFs
    rather than raising — the caller decides what to do with an empty result.

    Args:
        pdf_bytes: Raw bytes of a PDF file.

    Returns:
        Concatenated plain text from all pages, joined with newlines.
        Returns "" if pdfplumber is not installed or the PDF has no text layer.

    Examples:
        >>> isinstance(extract_text_from_pdf(b""), str)
        True
    """
    if not _PDFPLUMBER_AVAILABLE or not pdf_bytes:
        return ""

    try:
        pages: list[str] = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                try:
                    text = page.extract_text() or ""
                    pages.append(text.strip())
                except Exception:
                    pages.append("")
        return "\n".join(p for p in pages if p).strip()
    except Exception:
        return ""


def extract_images_from_pdf(pdf_bytes: bytes) -> list[bytes]:
    """Render each page of a PDF as a PNG image.

    Uses PyMuPDF (fitz) to render pages at 150 DPI. Returns raw PNG bytes
    for each page — these are intended for math OCR in Phase 2 (pix2tex).
    Returns an empty list for corrupt PDFs or if PyMuPDF is not installed.

    Args:
        pdf_bytes: Raw bytes of a PDF file.

    Returns:
        List of PNG bytes, one per page. Empty list on error or empty input.

    Examples:
        >>> isinstance(extract_images_from_pdf(b""), list)
        True
    """
    if not _PYMUPDF_AVAILABLE or not pdf_bytes:
        return []

    images: list[bytes] = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page_index in range(len(doc)):
            try:
                page = doc.load_page(page_index)
                mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
                pix = page.get_pixmap(matrix=mat)
                images.append(pix.tobytes("png"))
            except Exception:
                continue
        doc.close()
    except Exception:
        return []

    return images


def page_count(pdf_bytes: bytes) -> int:
    """Return the number of pages in a PDF, or 0 on error.

    Args:
        pdf_bytes: Raw bytes of a PDF file.

    Returns:
        Integer page count. Returns 0 for empty input or corrupt PDFs.
    """
    if not pdf_bytes:
        return 0

    if _PYMUPDF_AVAILABLE:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            count = len(doc)
            doc.close()
            return count
        except Exception:
            pass

    if _PDFPLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                return len(pdf.pages)
        except Exception:
            pass

    return 0

"""L4 Input Processor — PDF text and image extraction, with per-page OCR routing.

Handles corrupt/empty/encrypted PDFs without crashing — callers receive
an empty result rather than an exception for bad inputs.

Rules from CLAUDE.md:
- This module does not IMPLEMENT OCR — it DELEGATES image pages to the
  ocr_service (pix2tex). Translation (L3) stays out of this module.
- Layer L4 only — no hardware calls, no Braille logic here.

Phase 3 adds extract_pages(): page-by-page routing so a math-heavy PDF whose
equations are images (no text layer) is OCR'd, not silently dropped.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Optional

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

# Minimum alphabetic characters for a page's text layer to count as "real text"
# rather than a stray page number / artifact (which should route to OCR).
_MIN_MEANINGFUL_LETTERS = 3


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


# ---------------------------------------------------------------------------
# Phase 3 — per-page routing (text vs OCR vs none)
# ---------------------------------------------------------------------------

@dataclass
class PageExtraction:
    """What we managed to pull from one PDF page, before translation."""

    page_number: int                       # 1-based
    extraction_method: str                 # "text" | "ocr" | "none"
    raw_text: Optional[str] = None         # set when method == "text"
    latex_expressions: list[str] = field(default_factory=list)  # set when method == "ocr"
    confidence: Optional[float] = None     # mean OCR confidence, if method == "ocr"


def is_meaningful_text(text: str) -> bool:
    """True if a page's text layer has real words, not just a number/whitespace."""
    letters = sum(1 for ch in (text or "") if ch.isalpha())
    return letters >= _MIN_MEANINGFUL_LETTERS


def _page_has_images(page) -> bool:
    try:
        return len(page.get_images(full=True)) > 0
    except Exception:
        return False


def _render_page_png(page) -> bytes:
    mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
    return page.get_pixmap(matrix=mat).tobytes("png")


def extract_pages(pdf_bytes: bytes, ocr=None) -> list[PageExtraction]:
    """Process a PDF page by page, routing each page to text or OCR.

    For each page:
      - if the text layer has meaningful words -> method "text"
      - elif the page has embedded images and OCR yields usable LaTeX -> "ocr"
      - else -> "none" (nothing readable on this page)

    OCR is delegated to the ocr_service (pix2tex); pass a stand-in via `ocr`
    for testing. Never raises — a corrupt/empty PDF yields an empty list.

    Args:
        pdf_bytes: raw PDF bytes.
        ocr: object with extract_latex_from_bytes(bytes) -> OCRResult. Defaults
             to the shared MathOCRService singleton (lazily imported).

    Returns:
        One PageExtraction per page, in order. Empty list on corrupt/empty input.
    """
    if not _PYMUPDF_AVAILABLE or not pdf_bytes:
        return []

    if ocr is None:
        # Lazy import keeps the heavy pix2tex stack out of module import time.
        from backend.services.ocr_service import ocr_service as ocr  # type: ignore

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return []

    pages: list[PageExtraction] = []
    try:
        for i in range(len(doc)):
            page = doc.load_page(i)
            text = (page.get_text() or "").strip()

            if is_meaningful_text(text):
                pages.append(PageExtraction(i + 1, "text", raw_text=text))
                continue

            if _page_has_images(page):
                try:
                    png = _render_page_png(page)
                    result = ocr.extract_latex_from_bytes(png, f"page_{i + 1}.png")
                except Exception:
                    result = None
                if result is not None and result.is_usable():
                    pages.append(PageExtraction(
                        i + 1, "ocr",
                        latex_expressions=[result.latex],
                        confidence=result.confidence,
                    ))
                    continue

            pages.append(PageExtraction(i + 1, "none"))
    finally:
        doc.close()

    return pages

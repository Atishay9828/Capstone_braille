"""L4/L5 — OCR and PDF processing endpoints.

Phase 1: PDF text extraction + Braille translation.
Phase 2 (not yet): image math OCR via pix2tex.

Route handlers call services only — no business logic here.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.services.pdf_processor import extract_text_from_pdf, page_count
from backend.services.translator import BrailleGrade, translate_text

router = APIRouter(prefix="/ocr", tags=["ocr"])


class ProcessPdfResponse(BaseModel):
    filename: str
    page_count: int
    braille_unicode: str
    dot_patterns: list[int]
    cell_count: int


@router.post("/process-pdf", response_model=ProcessPdfResponse)
async def process_pdf(file: UploadFile = File(...)) -> ProcessPdfResponse:
    """Extract text from a PDF upload and translate it to Grade 1 Braille.

    Accepts a .pdf file. Extracts the text layer with pdfplumber, passes
    it through liblouis Grade 1 translation, and returns Braille dot patterns.

    Status codes:
    - 400: empty file or wrong content type
    - 422: PDF has no extractable text (image-only or corrupt)
    - 503: liblouis not available on this server
    """
    content_type = file.content_type or ""
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf") and "pdf" not in content_type:
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted (.pdf extension required).",
        )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    n_pages = page_count(pdf_bytes)

    try:
        text = extract_text_from_pdf(pdf_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF extraction error: {exc}")

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extractable text found. The PDF may be image-only or corrupt.",
        )

    try:
        result = translate_text(text, BrailleGrade.GRADE_1)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return ProcessPdfResponse(
        filename=filename,
        page_count=n_pages,
        braille_unicode=result.braille_unicode,
        dot_patterns=result.dot_patterns,
        cell_count=result.cell_count,
    )


# ---------------------------------------------------------------------------
# Phase 2 placeholder — pix2tex math OCR
# ---------------------------------------------------------------------------
# @router.post("/ocr-image")
# async def ocr_image(file: UploadFile = File(...)):
#     """Extract LaTeX from a math image using pix2tex (Phase 2)."""
#     raise HTTPException(status_code=501, detail="Phase 2 not yet implemented.")

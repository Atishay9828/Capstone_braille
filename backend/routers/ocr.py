"""L4/L5 — OCR and PDF processing endpoints.

Phase 1: PDF text extraction + Braille translation.
Phase 2: image math OCR via pix2tex → LaTeX → Nemeth Braille.

Route handlers validate input, call services, and shape responses.
The heavy algorithmic work lives in services/ (OCR in ocr_service,
preprocessing in image_preprocessor, translation in translator).
"""

import time

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.models.schemas import (
    ImageToBrailleResponse,
    OCRImageResponse,
    PipelineStages,
)
from backend.services.image_preprocessor import (
    MAX_IMAGE_BYTES,
    image_from_bytes,
    preprocess_for_ocr,
)
from backend.services.pdf_processor import extract_text_from_pdf, page_count
from backend.services.translator import BrailleGrade, translate_math, translate_text

router = APIRouter(prefix="/ocr", tags=["ocr"])

# Image content types / extensions accepted by the math OCR endpoints.
_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp")


def _validate_image_upload(filename: str, content_type: str, size: int) -> None:
    """Validate an uploaded image. Raises HTTPException on failure.

    - 400: empty file or non-image type
    - 413: file exceeds MAX_IMAGE_BYTES (10 MB)
    """
    if size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Maximum is {MAX_IMAGE_BYTES // 1024 // 1024} MB.",
        )
    is_image_ext = filename.lower().endswith(_IMAGE_EXTENSIONS)
    is_image_ct = content_type.startswith("image/")
    if not is_image_ext and not is_image_ct:
        raise HTTPException(
            status_code=400,
            detail="Only image files are accepted (png/jpg/gif/bmp/tiff/webp).",
        )


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
# Phase 2 — math image OCR (pix2tex)
# ---------------------------------------------------------------------------

@router.post("/image", response_model=OCRImageResponse)
async def ocr_image(file: UploadFile = File(...)) -> OCRImageResponse:
    """Extract LaTeX from a math image using pix2tex.

    Accepts an image (png/jpg/gif/bmp/tiff/webp). Returns the raw OCR LaTeX
    plus quality metrics. An unreadable image is NOT a server error — it
    returns 200 with success=false so the client can show a quality message.

    Status codes:
    - 400: empty file or non-image type
    - 413: file exceeds 10 MB
    - 200: OCR ran (success flag indicates whether output is usable)
    """
    from backend.services import ocr_service as ocr_module

    image_bytes = await file.read()
    filename = file.filename or ""
    _validate_image_upload(filename, file.content_type or "", len(image_bytes))

    result = ocr_module.ocr_service.extract_latex_from_bytes(image_bytes, filename)

    return OCRImageResponse(
        filename=filename,
        latex=result.latex,
        confidence=round(result.confidence, 3),
        preprocessing_applied=result.preprocessing_applied,
        inference_time_ms=round(result.inference_time_ms, 1),
        success=result.is_usable(),
        error=result.error,
    )


@router.post("/image-to-braille", response_model=ImageToBrailleResponse)
async def image_to_braille(
    file: UploadFile = File(...),
    grade: int = 1,
) -> ImageToBrailleResponse:
    """Full demo pipeline: math image → LaTeX → Nemeth Braille dot patterns.

    Decodes the image, preprocesses it, runs pix2tex OCR, then translates the
    LaTeX to Nemeth Braille via liblouis. Each stage is timed separately for
    latency profiling.

    A failure at any stage (unreadable image, empty OCR, translation error)
    returns 200 with success=false and empty Braille — the pipeline itself is
    working; the input was simply not usable.

    Status codes:
    - 400: empty file or non-image type
    - 413: file exceeds 10 MB
    - 200: pipeline ran (success flag indicates whether Braille was produced)
    """
    from backend.services import ocr_service as ocr_module

    image_bytes = await file.read()
    filename = file.filename or ""
    _validate_image_upload(filename, file.content_type or "", len(image_bytes))

    t_total = time.perf_counter()
    preprocessing_ms = 0.0
    ocr_ms = 0.0
    translation_ms = 0.0

    def _fail(error: str, latex: str | None = None, confidence: float = 0.0) -> ImageToBrailleResponse:
        return ImageToBrailleResponse(
            filename=filename,
            latex=latex,
            braille_unicode="",
            dot_patterns=[],
            cell_count=0,
            ocr_confidence=round(confidence, 3),
            total_time_ms=round((time.perf_counter() - t_total) * 1000, 1),
            pipeline_stages=PipelineStages(
                preprocessing_ms=round(preprocessing_ms, 1),
                ocr_ms=round(ocr_ms, 1),
                translation_ms=round(translation_ms, 1),
            ),
            success=False,
            error=error,
        )

    # Stage 1 — decode + preprocess
    try:
        image = image_from_bytes(image_bytes, filename)
        t0 = time.perf_counter()
        image = preprocess_for_ocr(image)
        preprocessing_ms = (time.perf_counter() - t0) * 1000
    except ValueError as exc:
        return _fail(f"Image error: {exc}")

    # Stage 2 — OCR (already preprocessed, so skip the service's preprocessing)
    ocr_result = ocr_module.ocr_service.extract_latex_from_image(image, preprocess=False)
    ocr_ms = ocr_result.inference_time_ms
    if not ocr_result.is_usable():
        return _fail(
            ocr_result.error or "OCR produced no usable LaTeX.",
            latex=ocr_result.latex,
            confidence=ocr_result.confidence,
        )

    # Stage 3 — LaTeX → Nemeth Braille
    t2 = time.perf_counter()
    try:
        translation = translate_math(ocr_result.latex)
    except RuntimeError as exc:
        return _fail(str(exc), latex=ocr_result.latex, confidence=ocr_result.confidence)
    except ValueError as exc:
        return _fail(str(exc), latex=ocr_result.latex, confidence=ocr_result.confidence)
    translation_ms = (time.perf_counter() - t2) * 1000

    return ImageToBrailleResponse(
        filename=filename,
        latex=ocr_result.latex,
        braille_unicode=translation.braille_unicode,
        dot_patterns=translation.dot_patterns,
        cell_count=translation.cell_count,
        ocr_confidence=round(ocr_result.confidence, 3),
        total_time_ms=round((time.perf_counter() - t_total) * 1000, 1),
        pipeline_stages=PipelineStages(
            preprocessing_ms=round(preprocessing_ms, 1),
            ocr_ms=round(ocr_ms, 1),
            translation_ms=round(translation_ms, 1),
        ),
        success=True,
        error=None,
    )

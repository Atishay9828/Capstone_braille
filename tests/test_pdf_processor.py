"""Tests for L4 PDF processor (backend/services/pdf_processor.py)
and the POST /ocr/process-pdf endpoint.

The _HELLO_PDF fixture is a minimal valid PDF with the text "hello world"
constructed directly as raw bytes — no PDF library required to run tests.
"""

import io

import pytest

from backend.services.pdf_processor import (
    _PDFPLUMBER_AVAILABLE,
    _PYMUPDF_AVAILABLE,
    extract_images_from_pdf,
    extract_pages,
    extract_text_from_pdf,
    is_meaningful_text,
    page_count,
)
from backend.services.ocr_service import OCRResult

# ---------------------------------------------------------------------------
# Minimal single-page PDF containing the text "hello world".
# Generated offline and embedded so tests have zero extra dependencies.
# ---------------------------------------------------------------------------
_HELLO_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n"
    b"   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    b"4 0 obj\n<< /Length 44 >>\nstream\n"
    b"BT /F1 12 Tf 100 700 Td (hello world) Tj ET\n"
    b"endstream\nendobj\n"
    b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    b"xref\n0 6\n"
    b"0000000000 65535 f \n"
    b"0000000009 00000 n \n"
    b"0000000058 00000 n \n"
    b"0000000115 00000 n \n"
    b"0000000266 00000 n \n"
    b"0000000360 00000 n \n"
    b"trailer\n<< /Root 1 0 R /Size 6 >>\n"
    b"startxref\n450\n%%EOF\n"
)
_GARBAGE = b"not a pdf at all \x00\x01\x02"
_EMPTY = b""


# ---------------------------------------------------------------------------
# extract_text_from_pdf
# ---------------------------------------------------------------------------

class TestExtractText:
    def test_always_returns_str(self):
        assert isinstance(extract_text_from_pdf(_EMPTY), str)

    def test_empty_bytes_gives_empty_string(self):
        assert extract_text_from_pdf(_EMPTY) == ""

    def test_garbage_bytes_does_not_raise(self):
        result = extract_text_from_pdf(_GARBAGE)
        assert isinstance(result, str)

    def test_corrupt_prefix_does_not_raise(self):
        result = extract_text_from_pdf(b"%PDF-1.4\ngarbage\x00\xff")
        assert isinstance(result, str)

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    def test_valid_pdf_returns_non_empty_string(self):
        text = extract_text_from_pdf(_HELLO_PDF)
        assert isinstance(text, str)
        assert len(text) > 0

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    def test_valid_pdf_contains_expected_text(self):
        text = extract_text_from_pdf(_HELLO_PDF)
        assert "hello" in text.lower() or "world" in text.lower()

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    def test_result_has_no_leading_trailing_whitespace(self):
        text = extract_text_from_pdf(_HELLO_PDF)
        assert text == text.strip()


# ---------------------------------------------------------------------------
# extract_images_from_pdf  (pages rendered as PNG)
# ---------------------------------------------------------------------------

class TestExtractImages:
    def test_always_returns_list(self):
        assert isinstance(extract_images_from_pdf(_EMPTY), list)

    def test_empty_bytes_returns_empty_list(self):
        assert extract_images_from_pdf(_EMPTY) == []

    def test_garbage_bytes_returns_empty_list(self):
        assert extract_images_from_pdf(_GARBAGE) == []

    def test_corrupt_prefix_does_not_raise(self):
        result = extract_images_from_pdf(b"%PDF-1.4\ngarbage\x00\xff")
        assert isinstance(result, list)

    @pytest.mark.skipif(not _PYMUPDF_AVAILABLE, reason="PyMuPDF not installed")
    def test_valid_pdf_returns_one_png_per_page(self):
        images = extract_images_from_pdf(_HELLO_PDF)
        assert len(images) == 1

    @pytest.mark.skipif(not _PYMUPDF_AVAILABLE, reason="PyMuPDF not installed")
    def test_images_are_bytes(self):
        images = extract_images_from_pdf(_HELLO_PDF)
        assert all(isinstance(img, bytes) for img in images)

    @pytest.mark.skipif(not _PYMUPDF_AVAILABLE, reason="PyMuPDF not installed")
    def test_images_are_valid_png(self):
        images = extract_images_from_pdf(_HELLO_PDF)
        # PNG magic bytes: \x89PNG
        for img in images:
            assert img[:4] == b"\x89PNG", "Each page should be rendered as PNG"


# ---------------------------------------------------------------------------
# page_count
# ---------------------------------------------------------------------------

class TestPageCount:
    def test_empty_bytes_returns_zero(self):
        assert page_count(_EMPTY) == 0

    def test_garbage_returns_zero(self):
        assert page_count(_GARBAGE) == 0

    @pytest.mark.skipif(
        not _PYMUPDF_AVAILABLE and not _PDFPLUMBER_AVAILABLE,
        reason="neither PyMuPDF nor pdfplumber installed",
    )
    def test_single_page_pdf_returns_one(self):
        assert page_count(_HELLO_PDF) == 1


# ---------------------------------------------------------------------------
# POST /ocr/process-pdf  (API integration)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestProcessPdfEndpoint:
    async def test_empty_upload_is_rejected(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("test.pdf", b"", "application/pdf")},
        )
        assert resp.status_code == 400

    async def test_garbage_pdf_is_rejected(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("test.pdf", _GARBAGE, "application/pdf")},
        )
        # 422 (no text) or 400/500 — never a silent 200
        assert resp.status_code in (400, 422, 500, 503)

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    async def test_valid_pdf_returns_200_or_422(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("test.pdf", _HELLO_PDF, "application/pdf")},
        )
        assert resp.status_code in (200, 422, 503)

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    async def test_200_response_has_correct_schema(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("test.pdf", _HELLO_PDF, "application/pdf")},
        )
        if resp.status_code == 200:
            data = resp.json()
            assert "filename" in data
            assert "page_count" in data
            assert "braille_unicode" in data
            assert "dot_patterns" in data
            assert "cell_count" in data
            assert data["filename"] == "test.pdf"
            assert data["page_count"] >= 1
            assert all(0 <= p <= 63 for p in data["dot_patterns"])
            assert data["cell_count"] == len(data["dot_patterns"])

    @pytest.mark.skipif(not _PDFPLUMBER_AVAILABLE, reason="pdfplumber not installed")
    async def test_non_pdf_rejected(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Phase 3 — per-page routing (extract_pages)
# ---------------------------------------------------------------------------

def _png_bytes(text_dummy: bool = False) -> bytes:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (300, 120), "white")
    ImageDraw.Draw(img).text((10, 40), "eq", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _text_pdf(text: str) -> bytes:
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def _image_pdf() -> bytes:
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_image(fitz.Rect(50, 50, 400, 200), stream=_png_bytes())
    data = doc.tobytes()
    doc.close()
    return data


def _mixed_pdf() -> bytes:
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "This page has a meaningful sentence of words")
    img_page = doc.new_page()
    img_page.insert_image(fitz.Rect(50, 50, 400, 200), stream=_png_bytes())
    doc.new_page()  # blank
    data = doc.tobytes()
    doc.close()
    return data


class _FakeOCR:
    """Records calls; returns a fixed usable OCRResult."""

    def __init__(self, latex: str = "x^2 + 1 = 0", usable: bool = True):
        self.calls = 0
        self._latex = latex
        self._usable = usable

    def extract_latex_from_bytes(self, data, filename=""):
        self.calls += 1
        if self._usable:
            return OCRResult(True, self._latex, 0.8, True, 5.0)
        return OCRResult(False, None, 0.0, True, 5.0, error="unreadable")


class TestIsMeaningfulText:
    def test_words_are_meaningful(self):
        assert is_meaningful_text("hello world") is True

    def test_page_number_is_not_meaningful(self):
        assert is_meaningful_text("12") is False

    def test_whitespace_is_not_meaningful(self):
        assert is_meaningful_text("   \n ") is False


@pytest.mark.skipif(not _PYMUPDF_AVAILABLE, reason="PyMuPDF not installed")
class TestExtractPages:
    def test_corrupt_returns_empty_list(self):
        assert extract_pages(_GARBAGE) == []
        assert extract_pages(_EMPTY) == []

    def test_text_page_uses_text_pipeline(self):
        ocr = _FakeOCR()
        pages = extract_pages(_text_pdf("Solve the following equations carefully"), ocr=ocr)
        assert len(pages) == 1
        assert pages[0].extraction_method == "text"
        assert ocr.calls == 0  # OCR must NOT run for a text page

    def test_image_page_falls_to_ocr(self):
        ocr = _FakeOCR(latex="x^2 + 1 = 0")
        pages = extract_pages(_image_pdf(), ocr=ocr)
        assert len(pages) == 1
        assert pages[0].extraction_method == "ocr"
        assert pages[0].latex_expressions == ["x^2 + 1 = 0"]
        assert ocr.calls == 1

    def test_image_page_unreadable_marked_none(self):
        ocr = _FakeOCR(usable=False)
        pages = extract_pages(_image_pdf(), ocr=ocr)
        assert pages[0].extraction_method == "none"

    def test_mixed_pdf_handles_both(self):
        ocr = _FakeOCR()
        pages = extract_pages(_mixed_pdf(), ocr=ocr)
        methods = [p.extraction_method for p in pages]
        assert methods == ["text", "ocr", "none"]
        assert ocr.calls == 1  # only the image page

    def test_page_numbers_are_sequential(self):
        ocr = _FakeOCR()
        pages = extract_pages(_mixed_pdf(), ocr=ocr)
        assert [p.page_number for p in pages] == [1, 2, 3]


@pytest.mark.skipif(not _PYMUPDF_AVAILABLE or not _PDFPLUMBER_AVAILABLE,
                    reason="PDF libs not installed")
@pytest.mark.asyncio
class TestProcessPdfPerPage:
    async def test_response_has_per_page_breakdown(self, test_client):
        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("doc.pdf", _text_pdf("A meaningful sentence here"), "application/pdf")},
        )
        if resp.status_code == 200:
            data = resp.json()
            assert "pages" in data and len(data["pages"]) == 1
            assert data["pages"][0]["extraction_method"] == "text"
            assert data["text_pages"] == 1
            assert "processing_time_ms" in data
            # backward-compatible combined fields
            assert data["combined_braille"] == data["braille_unicode"]
            assert data["combined_dot_patterns"] == data["dot_patterns"]

    async def test_combined_braille_concatenates_all_pages(self, test_client):
        # Two text pages -> combined dot patterns should be the sum of both pages.
        import fitz
        doc = fitz.open()
        doc.new_page().insert_text((72, 72), "First page meaningful words")
        doc.new_page().insert_text((72, 72), "Second page meaningful words")
        data_pdf = doc.tobytes()
        doc.close()

        resp = await test_client.post(
            "/ocr/process-pdf",
            files={"file": ("two.pdf", data_pdf, "application/pdf")},
        )
        if resp.status_code == 200:
            data = resp.json()
            assert len(data["pages"]) == 2
            per_page_total = sum(len(p["dot_patterns"]) for p in data["pages"])
            assert len(data["combined_dot_patterns"]) == per_page_total
            assert data["cell_count"] == per_page_total

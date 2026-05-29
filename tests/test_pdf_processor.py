"""Tests for L4 PDF processor (backend/services/pdf_processor.py)
and the POST /ocr/process-pdf endpoint.

The _HELLO_PDF fixture is a minimal valid PDF with the text "hello world"
constructed directly as raw bytes — no PDF library required to run tests.
"""

import pytest

from backend.services.pdf_processor import (
    _PDFPLUMBER_AVAILABLE,
    _PYMUPDF_AVAILABLE,
    extract_images_from_pdf,
    extract_text_from_pdf,
    page_count,
)

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

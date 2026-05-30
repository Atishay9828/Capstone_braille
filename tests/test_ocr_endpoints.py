"""Integration tests for the Phase 2 OCR endpoints.

- POST /ocr/image             — raw image → LaTeX
- POST /ocr/image-to-braille  — image → LaTeX → Nemeth Braille (demo endpoint)

pix2tex is NEVER run for real here. We patch the module-level
backend.services.ocr_service.ocr_service with a fake that returns canned
OCRResults. Image decode + preprocessing run for real (fast, pure PIL);
translation runs for real against liblouis (may be 503-equivalent → the
pipeline returns success=false, which these tests tolerate).
"""

import io

import pytest
from httpx import AsyncClient
from PIL import Image

from backend.services.ocr_service import OCRResult


# ---------------------------------------------------------------------------
# Helpers / fakes
# ---------------------------------------------------------------------------

def _png_bytes(width: int = 700, height: int = 200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buf, format="PNG")
    return buf.getvalue()


class _FakeOCRService:
    """Stand-in for MathOCRService that returns a fixed OCRResult."""

    def __init__(self, result: OCRResult) -> None:
        self._result = result

    def extract_latex_from_bytes(self, data, filename="", preprocess=True):
        return self._result

    def extract_latex_from_image(self, image, preprocess=True):
        return self._result


def _patch_ocr(monkeypatch, result: OCRResult) -> None:
    monkeypatch.setattr(
        "backend.services.ocr_service.ocr_service",
        _FakeOCRService(result),
    )


def _good_result(latex: str = "x + 2 = 5") -> OCRResult:
    return OCRResult(
        success=True, latex=latex, confidence=0.85,
        preprocessing_applied=True, inference_time_ms=8400.0,
    )


def _failed_result(error: str = "OCR failed") -> OCRResult:
    return OCRResult(
        success=False, latex=None, confidence=0.0,
        preprocessing_applied=True, inference_time_ms=0.0, error=error,
    )


# ---------------------------------------------------------------------------
# POST /ocr/image
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestOcrImageEndpoint:
    async def test_happy_path(self, test_client: AsyncClient, monkeypatch) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image",
            files={"file": ("eq.png", _png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "eq.png"
        assert data["latex"] == "x + 2 = 5"
        assert data["success"] is True
        assert 0.0 <= data["confidence"] <= 1.0
        assert "inference_time_ms" in data

    async def test_response_has_all_fields(self, test_client: AsyncClient, monkeypatch) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image", files={"file": ("eq.png", _png_bytes(), "image/png")}
        )
        data = resp.json()
        for key in ("filename", "latex", "confidence", "preprocessing_applied",
                    "inference_time_ms", "success", "error"):
            assert key in data

    async def test_unreadable_image_returns_200_success_false(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _failed_result("pix2tex produced empty output"))
        resp = await test_client.post(
            "/ocr/image", files={"file": ("blurry.png", _png_bytes(), "image/png")}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    async def test_invalid_file_type_rejected(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image",
            files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert resp.status_code == 400

    async def test_empty_file_rejected(self, test_client: AsyncClient, monkeypatch) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image", files={"file": ("empty.png", b"", "image/png")}
        )
        assert resp.status_code == 400

    async def test_too_large_file_rejected(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result())
        oversized = b"\x89PNG" + b"x" * (10 * 1024 * 1024 + 1)
        resp = await test_client.post(
            "/ocr/image", files={"file": ("big.png", oversized, "image/png")}
        )
        assert resp.status_code == 413


# ---------------------------------------------------------------------------
# POST /ocr/image-to-braille
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestImageToBrailleEndpoint:
    async def test_full_pipeline_structure(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result("1 + 1 = 2"))
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("eq.png", _png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Raw OCR latex always surfaced for debugging.
        assert data["latex"] == "1 + 1 = 2"
        # If liblouis is present, the pipeline fully succeeds.
        if data["success"]:
            assert data["braille_unicode"] != ""
            assert len(data["dot_patterns"]) > 0
            assert data["cell_count"] == len(data["dot_patterns"])

    async def test_timing_fields_present(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result("x = 1"))
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("eq.png", _png_bytes(), "image/png")},
        )
        data = resp.json()
        assert "total_time_ms" in data
        assert "pipeline_stages" in data
        for key in ("preprocessing_ms", "ocr_ms", "translation_ms"):
            assert key in data["pipeline_stages"]

    async def test_ocr_failure_returns_200_graceful(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _failed_result("unreadable"))
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("bad.png", _png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["braille_unicode"] == ""
        assert data["dot_patterns"] == []
        assert data["error"] is not None

    async def test_invalid_file_type_rejected(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert resp.status_code == 400

    async def test_empty_file_rejected(self, test_client: AsyncClient, monkeypatch) -> None:
        _patch_ocr(monkeypatch, _good_result())
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("empty.png", b"", "image/png")},
        )
        assert resp.status_code == 400

    async def test_tiny_image_fails_gracefully(
        self, test_client: AsyncClient, monkeypatch
    ) -> None:
        _patch_ocr(monkeypatch, _good_result())
        tiny = _png_bytes(width=40, height=40)
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("tiny.png", tiny, "image/png")},
        )
        # Decodable but too small → preprocessing rejects → 200 success=false.
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    async def test_jpeg_accepted(self, test_client: AsyncClient, monkeypatch) -> None:
        _patch_ocr(monkeypatch, _good_result("x"))
        buf = io.BytesIO()
        Image.new("RGB", (700, 200), "white").save(buf, format="JPEG")
        resp = await test_client.post(
            "/ocr/image-to-braille",
            files={"file": ("eq.jpg", buf.getvalue(), "image/jpeg")},
        )
        assert resp.status_code == 200

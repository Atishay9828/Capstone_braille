"""Tests for backend/services/ocr_service.py.

CRITICAL: pix2tex CPU inference takes 5–30s per image. We NEVER run the real
model in the test suite. Every test injects a fake/mocked model so the suite
stays fast and runs in CI without the 1.5 GB model download.

Mocking strategy:
    MathOCRService._ensure_model() short-circuits when _model_available is
    already set. So a test sets service._model = <callable> and
    service._model_available = True to inject a fake model with zero I/O.
"""

import io

import pytest
from PIL import Image

from backend.services.ocr_service import (
    MathOCRService,
    OCRResult,
    _estimate_confidence,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image(width: int = 600, height: int = 200, color: str = "white") -> Image.Image:
    return Image.new("RGB", (width, height), color)


def _image_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _service_with_fake_model(fake_callable) -> MathOCRService:
    """Build a service whose model is a fake callable (no real pix2tex load)."""
    svc = MathOCRService()
    svc._model = fake_callable
    svc._model_available = True
    return svc


def _service_unavailable() -> MathOCRService:
    """Build a service that reports the model as permanently unavailable."""
    svc = MathOCRService()
    svc._model = None
    svc._model_available = False
    return svc


# ---------------------------------------------------------------------------
# OCRResult dataclass
# ---------------------------------------------------------------------------

class TestOCRResult:
    def test_is_usable_true_for_good_result(self):
        r = OCRResult(True, "x + 2 = 5", 0.85, True, 100.0)
        assert r.is_usable() is True

    def test_is_usable_false_when_not_success(self):
        r = OCRResult(False, None, 0.0, True, 0.0, error="boom")
        assert r.is_usable() is False

    def test_is_usable_false_when_latex_none(self):
        r = OCRResult(True, None, 0.9, True, 100.0)
        assert r.is_usable() is False

    def test_is_usable_false_below_confidence_threshold(self):
        r = OCRResult(True, "x", 0.2, True, 100.0)
        assert r.is_usable() is False

    @pytest.mark.parametrize(
        "confidence,threshold,expected",
        [
            (0.3, 0.3, True),
            (0.29, 0.3, False),
            (0.5, 0.5, True),
            (0.49, 0.5, False),
            (1.0, 0.3, True),
            (0.0, 0.3, False),
        ],
    )
    def test_is_usable_threshold_parametrized(self, confidence, threshold, expected):
        r = OCRResult(True, "x + 1", confidence, True, 50.0)
        assert r.is_usable(min_confidence=threshold) is expected

    def test_to_dict_has_all_keys(self):
        r = OCRResult(True, "x", 0.8, True, 12.345)
        d = r.to_dict()
        assert set(d.keys()) == {
            "success", "latex", "confidence",
            "preprocessing_applied", "inference_time_ms", "error",
        }
        assert d["inference_time_ms"] == 12.3  # rounded to 1 dp


# ---------------------------------------------------------------------------
# extract_latex_from_image / from_bytes — happy paths
# ---------------------------------------------------------------------------

class TestExtractHappyPath:
    def test_from_image_returns_latex(self):
        svc = _service_with_fake_model(lambda img: "x + 2 = 5")
        result = svc.extract_latex_from_image(_make_image())
        assert result.success is True
        assert result.latex == "x + 2 = 5"
        assert result.confidence > 0.3
        assert result.is_usable()

    def test_from_bytes_happy_path(self):
        svc = _service_with_fake_model(lambda img: "a + b = c")
        data = _image_bytes(_make_image())
        result = svc.extract_latex_from_bytes(data, "eq.png")
        assert result.success is True
        assert result.latex == "a + b = c"

    def test_preprocessing_applied_by_default(self):
        svc = _service_with_fake_model(lambda img: "x = 1")
        result = svc.extract_latex_from_image(_make_image())
        assert result.preprocessing_applied is True

    def test_preprocessing_skippable(self):
        svc = _service_with_fake_model(lambda img: "x = 1")
        result = svc.extract_latex_from_image(_make_image(), preprocess=False)
        assert result.preprocessing_applied is False
        assert result.success is True

    def test_inference_time_is_measured(self):
        svc = _service_with_fake_model(lambda img: "x = 1")
        result = svc.extract_latex_from_image(_make_image())
        assert result.inference_time_ms >= 0.0
        assert isinstance(result.inference_time_ms, float)

    def test_latex_is_stripped(self):
        svc = _service_with_fake_model(lambda img: "   x + 1   ")
        result = svc.extract_latex_from_image(_make_image())
        assert result.latex == "x + 1"


# ---------------------------------------------------------------------------
# Failure modes
# ---------------------------------------------------------------------------

class TestExtractFailureModes:
    def test_empty_return_marks_unusable(self):
        svc = _service_with_fake_model(lambda img: "")
        result = svc.extract_latex_from_image(_make_image())
        assert result.success is False
        assert result.latex is None
        assert result.confidence == 0.0
        assert result.is_usable() is False

    def test_model_unavailable_returns_error(self):
        svc = _service_unavailable()
        result = svc.extract_latex_from_image(_make_image())
        assert result.success is False
        assert result.latex is None
        assert result.error is not None
        assert "pix2tex" in result.error.lower()

    def test_model_inference_exception_handled(self):
        def boom(img):
            raise RuntimeError("CUDA out of memory")
        svc = _service_with_fake_model(boom)
        result = svc.extract_latex_from_image(_make_image())
        assert result.success is False
        assert result.error is not None
        assert "CUDA out of memory" in result.error

    def test_corrupted_bytes_returns_error_gracefully(self):
        svc = _service_with_fake_model(lambda img: "x")
        result = svc.extract_latex_from_bytes(b"not an image \x00\xff", "bad.png")
        assert result.success is False
        assert result.error is not None
        assert result.latex is None

    def test_empty_bytes_returns_error(self):
        svc = _service_with_fake_model(lambda img: "x")
        result = svc.extract_latex_from_bytes(b"", "empty.png")
        assert result.success is False
        assert result.error is not None

    def test_tiny_image_preprocessing_error_handled(self):
        # 50x50 image fails preprocessing's minimum-size check.
        svc = _service_with_fake_model(lambda img: "x")
        result = svc.extract_latex_from_image(_make_image(width=50, height=50))
        assert result.success is False
        assert result.error is not None
        assert "small" in result.error.lower() or "Preprocessing" in result.error

    def test_never_raises_on_any_input(self):
        # Even a model that returns None must not crash the service.
        svc = _service_with_fake_model(lambda img: None)
        result = svc.extract_latex_from_image(_make_image())
        assert isinstance(result, OCRResult)
        assert result.success is False


# ---------------------------------------------------------------------------
# Large image robustness
# ---------------------------------------------------------------------------

class TestLargeImage:
    def test_large_image_doesnt_crash(self):
        svc = _service_with_fake_model(lambda img: "x^2 + y^2 = z^2")
        result = svc.extract_latex_from_image(_make_image(width=3000, height=1000))
        assert isinstance(result, OCRResult)
        assert result.success is True


# ---------------------------------------------------------------------------
# Model lifecycle
# ---------------------------------------------------------------------------

class TestModelLifecycle:
    def test_is_available_reflects_unavailable(self):
        svc = _service_unavailable()
        assert svc.is_available() is False

    def test_is_available_reflects_available(self):
        svc = _service_with_fake_model(lambda img: "x")
        assert svc.is_available() is True

    def test_model_not_loaded_at_construction(self):
        # Fresh service must not eagerly load the heavy model.
        svc = MathOCRService()
        assert svc._model is None
        assert svc._model_available is None


# ---------------------------------------------------------------------------
# Confidence heuristic
# ---------------------------------------------------------------------------

class TestConfidenceHeuristic:
    def test_empty_string_zero(self):
        assert _estimate_confidence("") == 0.0

    def test_one_char_low(self):
        assert _estimate_confidence("x") <= 0.1

    def test_simple_math_high(self):
        assert _estimate_confidence("x + 2 = 5") >= 0.8

    def test_latex_command_moderate(self):
        c = _estimate_confidence(r"\frac{a}{b} = c")
        assert 0.5 <= c <= 0.8

    def test_unmatched_braces_low(self):
        assert _estimate_confidence("x + {a") <= 0.3

    def test_garbage_markers_low(self):
        assert _estimate_confidence("x ??? y") <= 0.2

    def test_overlong_output_penalized(self):
        long_simple = "x + " * 100
        assert _estimate_confidence(long_simple) <= 0.5

    def test_exotic_commands_penalized(self):
        # Benchmark hallucination: plausible LaTeX but out-of-distribution for
        # school math (\cal, \lambda) → should be flagged low confidence.
        assert _estimate_confidence(r"{\cal X}^2 - \lambda = 0") <= 0.3

    def test_school_math_commands_not_penalized_as_exotic(self):
        # \frac, \sqrt, \sin, \cos, \tan, \theta are legitimate school math.
        assert _estimate_confidence(r"\sin\theta + \cos\theta = 1") >= 0.6
        assert _estimate_confidence(r"\frac{3}{4} + \frac{1}{2}") >= 0.6

    def test_confidence_in_valid_range(self):
        for s in ["", "x", "x+1", r"\sqrt{x}", "x ??? y", "{unmatched"]:
            c = _estimate_confidence(s)
            assert 0.0 <= c <= 1.0

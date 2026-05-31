"""L4 OCR Service — wraps pix2tex with preprocessing, error handling, fallback.

=== ENGINEERING NOTEBOOK (2026-05-31) ===

WHAT THIS IS:
  pix2tex (lukas-blecher/LaTeX-OCR v0.1.4) is a Vision Transformer + GPT-2
  decoder trained on im2latex to convert images of math equations to LaTeX.
  We use it as the Phase 2 OCR engine for the image → Braille pipeline.

WHY pix2tex:
  - Free, open-source (MIT), no API key needed
  - Runs locally (CPU or GPU), no external dependency at inference time
  - Returns LaTeX directly, compatible with our liblouis Nemeth pipeline
  - Active maintenance (latest release Jan 2025)

KNOWN LIMITATIONS:
  - CPU inference: 5–30 seconds per image (GPU: 1–5s)
  - No built-in confidence score — we estimate from output heuristics
  - Struggles with fractions (\frac), integrals, matrices, handwriting
  - Returns empty string "" on complete failure (no exception)
  - Model download ~1.5 GB on first use (HuggingFace cache)
  - Not tested on Python 3.14+

PREPROCESSING STRATEGY:
  pix2tex has an internal resolution-optimizing NN, so we:
  1. Convert to RGB (pix2tex is RGB-trained, grayscale hurts accuracy)
  2. Enhance contrast (1.5×) to lift faint print
  3. Sharpen once (phone camera blur recovery)
  We do NOT apply Otsu/binary thresholding — pix2tex uses raw pixel values.

CONFIDENCE DETECTION (heuristic since pix2tex returns no score):
  - Empty/1-2 chars → 0.0–0.1
  - Valid simple math (operators + variables) → 0.8
  - Valid LaTeX commands → 0.7
  - Unmatched braces or '???' markers → 0.2
  - Very long output for short input → 0.4 (over-generation)
  Threshold for usable output: 0.3 (configurable)

FAILURE HANDLING:
  This module NEVER raises an exception to the caller. All failures are
  returned as OCRResult(success=False, ...) so the API layer can return
  a clean 200 response with success=False rather than an HTTP 500.

=== END ENGINEERING NOTEBOOK ===
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Optional

from PIL import Image

from backend.services.image_preprocessor import (
    image_from_bytes,
    preprocess_for_ocr,
    should_preprocess,
)

# Lazy import — pix2tex is heavy; don't crash at module load time if unavailable.
try:
    from pix2tex.cli import LatexOCR as _LatexOCR  # type: ignore[import-untyped]
    _PIX2TEX_AVAILABLE: bool = True
except ImportError:
    _PIX2TEX_AVAILABLE = False


@dataclass
class OCRResult:
    """Result of a single OCR call. Always returned — never raises."""

    success: bool
    latex: Optional[str]
    confidence: float
    preprocessing_applied: bool
    inference_time_ms: float
    error: Optional[str] = None

    def is_usable(self, min_confidence: float = 0.3) -> bool:
        """True if result is good enough to pass to the translation engine."""
        return (
            self.success
            and bool(self.latex)
            and self.confidence >= min_confidence
        )

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "latex": self.latex,
            "confidence": round(self.confidence, 3),
            "preprocessing_applied": self.preprocessing_applied,
            "inference_time_ms": round(self.inference_time_ms, 1),
            "error": self.error,
        }


class MathOCRService:
    """L4 OCR service. Wraps pix2tex with preprocessing and error handling.

    The model is loaded lazily on first use to avoid slow startup.
    """

    def __init__(self) -> None:
        self._model: Optional[object] = None
        self._model_available: Optional[bool] = None

    def is_available(self) -> bool:
        """Return True if pix2tex is installed and the model is loadable."""
        if self._model_available is None:
            self._ensure_model()
        return bool(self._model_available)

    def _ensure_model(self) -> bool:
        """Load model on first use. Return False if unavailable."""
        if self._model_available is not None:
            return bool(self._model_available)

        if not _PIX2TEX_AVAILABLE:
            self._model_available = False
            return False

        try:
            self._model = _LatexOCR()
            self._model_available = True
            return True
        except Exception:
            self._model_available = False
            return False

    def extract_latex_from_image(
        self,
        image: Image.Image,
        preprocess: bool = True,
    ) -> OCRResult:
        """Run OCR on a PIL image. Returns OCRResult — never raises.

        Args:
            image: PIL image of a math equation.
            preprocess: Apply contrast + sharpening preprocessing.

        Returns:
            OCRResult with LaTeX and quality metrics.
        """
        pre_applied = False

        # Preprocess if requested
        if preprocess:
            try:
                if should_preprocess(image) or preprocess:
                    image = preprocess_for_ocr(image)
                    pre_applied = True
            except ValueError as exc:
                return OCRResult(
                    success=False,
                    latex=None,
                    confidence=0.0,
                    preprocessing_applied=False,
                    inference_time_ms=0.0,
                    error=f"Preprocessing failed: {exc}",
                )
            except Exception as exc:
                return OCRResult(
                    success=False,
                    latex=None,
                    confidence=0.0,
                    preprocessing_applied=False,
                    inference_time_ms=0.0,
                    error=f"Unexpected preprocessing error: {exc}",
                )

        # Check model availability
        if not self._ensure_model():
            return OCRResult(
                success=False,
                latex=None,
                confidence=0.0,
                preprocessing_applied=pre_applied,
                inference_time_ms=0.0,
                error="pix2tex is not available. Install with: pip install pix2tex",
            )

        # Run inference
        t_start = time.perf_counter()
        try:
            raw_output = self._model(image)  # type: ignore[operator]
            inference_ms = (time.perf_counter() - t_start) * 1000
        except Exception as exc:
            inference_ms = (time.perf_counter() - t_start) * 1000
            return OCRResult(
                success=False,
                latex=None,
                confidence=0.0,
                preprocessing_applied=pre_applied,
                inference_time_ms=inference_ms,
                error=f"pix2tex inference error: {exc}",
            )

        latex = str(raw_output).strip() if raw_output is not None else ""
        confidence = _estimate_confidence(latex)

        return OCRResult(
            success=bool(latex),
            latex=latex if latex else None,
            confidence=confidence,
            preprocessing_applied=pre_applied,
            inference_time_ms=inference_ms,
        )

    def extract_latex_from_bytes(
        self,
        image_bytes: bytes,
        filename: str = "",
        preprocess: bool = True,
    ) -> OCRResult:
        """Convenience wrapper accepting raw bytes (from file upload).

        Args:
            image_bytes: Raw image bytes (JPEG/PNG/etc.).
            filename: Optional filename for error messages.
            preprocess: Apply preprocessing pipeline.

        Returns:
            OCRResult — never raises.
        """
        try:
            image = image_from_bytes(image_bytes, filename)
        except ValueError as exc:
            return OCRResult(
                success=False,
                latex=None,
                confidence=0.0,
                preprocessing_applied=False,
                inference_time_ms=0.0,
                error=str(exc),
            )

        return self.extract_latex_from_image(image, preprocess=preprocess)


# ---------------------------------------------------------------------------
# Confidence heuristics
# ---------------------------------------------------------------------------

# Simple math characters that appear in basic LaTeX
_SIMPLE_MATH_CHARS = re.compile(r"^[a-zA-Z0-9\s\+\-\=\<\>\^\*\/\(\)\[\]\{\}\.\,\|\\]+$")
_GARBAGE_MARKERS = re.compile(r"\?\?\?|\\\\\\\\|<pad>|<unk>")
_LATEX_COMMANDS = re.compile(r"\\[a-zA-Z]+")

# Commands that essentially never appear in NCERT Class 6-12 math but DID show up
# in pix2tex's hallucinated outputs during the OCR benchmark (docs/ocr-benchmark-
# results.md): e.g. rad_sqrt -> runaway \stackrel/\phantom garble; quad_x2m4 ->
# plausible-but-wrong "{\cal X}^2-\lambda=0". Their presence is a strong signal of
# a low-confidence / hallucinated read for our target (school-level) curriculum.
_EXOTIC_COMMANDS = re.compile(
    r"\\(cal|mathcal|partial|lambda|stackrel|phantom|prod|longrightarrow|"
    r"leftrightarrow|overset|infty|rightarrow|aleph|wp|Im|Re)\b"
)


def _estimate_confidence(latex: str) -> float:
    """Estimate pix2tex output confidence via heuristics.

    pix2tex returns no confidence score, so we approximate from output
    characteristics. Thresholds are tuned against the measured OCR benchmark
    (docs/ocr-benchmark-results.md), not guessed. Intentionally conservative.

    Returns value in [0.0, 1.0].
    """
    if not latex:
        return 0.0

    length = len(latex)

    # Very short output on any image is likely a failure
    if length <= 2:
        return 0.1

    # Obvious garbage markers from model
    if _GARBAGE_MARKERS.search(latex):
        return 0.1

    # Check brace balance — unmatched braces = malformed LaTeX
    depth = 0
    for ch in latex:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        if depth < 0:
            return 0.2
    if depth != 0:
        return 0.2

    # Very long output often indicates hallucination
    if length > 200:
        return 0.4

    # Commands out-of-distribution for school math → likely hallucinated read.
    # Caught the benchmark's plausible-but-wrong "{\cal X}^2-\lambda=0" case.
    if _EXOTIC_COMMANDS.search(latex):
        return 0.3

    # Output contains valid LaTeX commands → moderately confident
    if _LATEX_COMMANDS.search(latex):
        return 0.7

    # Pure ASCII math characters → likely a simple equation, high confidence
    if _SIMPLE_MATH_CHARS.match(latex):
        return 0.85

    # Default mid-range
    return 0.6


# Module-level singleton for the FastAPI app to use.
ocr_service = MathOCRService()

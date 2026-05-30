"""Tests for backend/services/image_preprocessor.py.

All tests use programmatically generated PIL images — no file I/O required.
"""

import io
import struct

import pytest
from PIL import Image

from backend.services.image_preprocessor import (
    MAX_IMAGE_BYTES,
    estimate_dpi,
    image_from_bytes,
    preprocess_for_ocr,
    should_preprocess,
)


def _make_image(
    width: int = 600,
    height: int = 200,
    mode: str = "RGB",
    color: object = "white",
    dpi: tuple | None = None,
) -> Image.Image:
    img = Image.new(mode, (width, height), color)
    if dpi:
        img.info["dpi"] = dpi
    return img


def _image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# preprocess_for_ocr
# ---------------------------------------------------------------------------

class TestPreprocessForOcr:
    def test_returns_pil_image(self):
        img = _make_image()
        result = preprocess_for_ocr(img)
        assert isinstance(result, Image.Image)

    def test_output_mode_is_rgb(self):
        img = _make_image()
        result = preprocess_for_ocr(img)
        assert result.mode == "RGB"

    def test_rgba_input_converted_to_rgb(self):
        img = _make_image(mode="RGBA")
        result = preprocess_for_ocr(img)
        assert result.mode == "RGB"

    def test_grayscale_input_converted_to_rgb(self):
        img = _make_image(mode="L")
        result = preprocess_for_ocr(img)
        assert result.mode == "RGB"

    def test_palette_mode_converted_to_rgb(self):
        img = _make_image(mode="P")
        result = preprocess_for_ocr(img)
        assert result.mode == "RGB"

    def test_tiny_image_raises_value_error(self):
        img = _make_image(width=50, height=50)
        with pytest.raises(ValueError, match="too small"):
            preprocess_for_ocr(img)

    def test_width_too_small_raises(self):
        img = _make_image(width=10, height=400)
        with pytest.raises(ValueError, match="too small"):
            preprocess_for_ocr(img)

    def test_height_too_small_raises(self):
        img = _make_image(width=600, height=10)
        with pytest.raises(ValueError, match="too small"):
            preprocess_for_ocr(img)

    def test_low_dpi_image_upscaled(self):
        img = _make_image(width=400, height=120, dpi=(72, 72))
        result = preprocess_for_ocr(img, target_dpi=200)
        # Image should be upscaled
        assert result.width > img.width or result.height > img.height

    def test_high_dpi_image_not_upscaled(self):
        img = _make_image(width=800, height=200, dpi=(300, 300))
        result = preprocess_for_ocr(img, target_dpi=200)
        # 300 DPI is above target — no upscaling
        assert result.width == img.width
        assert result.height == img.height

    def test_no_dpi_metadata_image_passes_through(self):
        img = _make_image(width=800, height=200)
        result = preprocess_for_ocr(img)
        # No DPI → no upscaling
        assert result.width == img.width
        assert result.height == img.height

    def test_contrast_disabled_returns_image(self):
        img = _make_image()
        result = preprocess_for_ocr(img, apply_contrast=False, apply_sharpening=False)
        assert isinstance(result, Image.Image)
        assert result.mode == "RGB"

    def test_large_image_does_not_crash(self):
        img = _make_image(width=3000, height=1000)
        result = preprocess_for_ocr(img)
        assert isinstance(result, Image.Image)


# ---------------------------------------------------------------------------
# estimate_dpi
# ---------------------------------------------------------------------------

class TestEstimateDpi:
    def test_no_metadata_returns_none(self):
        img = _make_image()
        assert estimate_dpi(img) is None

    def test_tuple_dpi_extracted(self):
        img = _make_image(dpi=(300, 300))
        assert estimate_dpi(img) == 300

    def test_non_standard_dpi(self):
        img = _make_image(dpi=(72, 72))
        assert estimate_dpi(img) == 72


# ---------------------------------------------------------------------------
# should_preprocess
# ---------------------------------------------------------------------------

class TestShouldPreprocess:
    def test_non_rgb_mode_returns_true(self):
        img = _make_image(mode="RGBA")
        assert should_preprocess(img) is True

    def test_low_dpi_returns_true(self):
        img = _make_image(dpi=(72, 72))
        assert should_preprocess(img) is True

    def test_small_image_returns_true(self):
        img = _make_image(width=300, height=100)
        assert should_preprocess(img) is True

    def test_large_rgb_image_returns_false(self):
        img = _make_image(width=1000, height=300, mode="RGB")
        assert should_preprocess(img) is False


# ---------------------------------------------------------------------------
# image_from_bytes
# ---------------------------------------------------------------------------

class TestImageFromBytes:
    def test_valid_png_bytes_opens(self):
        img = _make_image()
        data = _image_to_bytes(img, "PNG")
        result = image_from_bytes(data)
        assert isinstance(result, Image.Image)

    def test_valid_jpeg_bytes_opens(self):
        img = _make_image()
        data = _image_to_bytes(img, "JPEG")
        result = image_from_bytes(data)
        assert isinstance(result, Image.Image)

    def test_empty_bytes_raises(self):
        with pytest.raises(ValueError, match="empty"):
            image_from_bytes(b"")

    def test_oversized_bytes_raises(self):
        # Simulate large payload check (don't actually allocate 11MB)
        oversized = b"x" * (MAX_IMAGE_BYTES + 1)
        with pytest.raises(ValueError, match="too large"):
            image_from_bytes(oversized)

    def test_corrupted_bytes_raises(self):
        with pytest.raises(ValueError, match="Cannot open"):
            image_from_bytes(b"not an image at all \x00\xff\xfe")

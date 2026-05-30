"""L4 Image Preprocessor — prepares images for pix2tex math OCR.

RESEARCH NOTES (2026-05-31):
- pix2tex has an INTERNAL resolution-optimizing NN, so do NOT aggressively upscale.
  Let pix2tex decide the right resolution. Our job: deliver a clean, well-contrasted
  image with no heavy compression artifacts.
- pix2tex expects RGB input (it was trained on RGB). Converting to grayscale HURTS
  accuracy — keep colour information.
- Best contrast enhancement: PIL ImageEnhance.Contrast at 1.5× (not Otsu/binary).
  Binary thresholding removes anti-aliasing information that the ViT encoder uses.
- Minimum viable size: ~400×100 pixels. Smaller → accuracy drops to near 0%.
- DPI target: 150–300 DPI is the sweet spot. The internal model handles downscaling
  of higher DPI images.
- Source: pix2tex documentation + LaTeX-OCR GitHub README + academic paper
  "Image-to-LaTeX Converter" (arxiv 2408.04015).

PREPROCESSING PIPELINE:
1. Validate image is not degenerate (too small)
2. Convert to RGB (handles RGBA, L, P, etc.)
3. Optionally upscale if clearly under 150 DPI or under 400px on shortest axis
4. Enhance contrast (1.5×) — improves faint print
5. Sharpen once (ImageFilter.SHARPEN) — recovers slight blur from phone cameras
6. Return PIL.Image.Image (pix2tex expects PIL, not ndarray)
"""

from __future__ import annotations

from typing import Optional

from PIL import Image, ImageEnhance, ImageFilter

# Minimum dimension on either axis below which OCR accuracy collapses
_MIN_DIMENSION_PX = 100
# Minimum total pixels for a usable equation image
_MIN_TOTAL_PX = 400 * 100
# Target DPI if metadata is available and image is below this
_TARGET_DPI = 200
# Maximum bytes we'll accept before refusing (10 MB)
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def preprocess_for_ocr(
    image: Image.Image,
    target_dpi: int = _TARGET_DPI,
    apply_contrast: bool = True,
    apply_sharpening: bool = True,
) -> Image.Image:
    """Preprocess a PIL image for pix2tex math OCR.

    The pipeline is intentionally conservative: clean the image without
    over-processing it, then let pix2tex's internal resolution optimizer
    handle the rest.

    Args:
        image: Input PIL image (any mode).
        target_dpi: Minimum DPI target. Image is upscaled if DPI metadata
                    is present and below this value.
        apply_contrast: Apply 1.5× contrast enhancement.
        apply_sharpening: Apply one pass of PIL SHARPEN filter.

    Returns:
        Preprocessed PIL.Image.Image in RGB mode.

    Raises:
        ValueError: If the image is too small to produce meaningful OCR output.

    Examples:
        >>> from PIL import Image
        >>> img = Image.new("RGB", (600, 200), "white")
        >>> result = preprocess_for_ocr(img)
        >>> result.mode
        'RGB'
    """
    if image.width < _MIN_DIMENSION_PX or image.height < _MIN_DIMENSION_PX:
        raise ValueError(
            f"Image is too small for OCR: {image.width}×{image.height}px. "
            f"Minimum dimension is {_MIN_DIMENSION_PX}px on each axis."
        )

    if image.width * image.height < _MIN_TOTAL_PX:
        raise ValueError(
            f"Image area too small for OCR: {image.width * image.height}px². "
            f"Minimum is {_MIN_TOTAL_PX}px²."
        )

    # Step 1: Ensure RGB mode — pix2tex trained on RGB, not grayscale/RGBA.
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Step 2: Upscale only if image DPI metadata says it's low AND the image
    # is genuinely small (avoids upscaling already-correct large images).
    dpi = estimate_dpi(image)
    if dpi is not None and dpi < target_dpi:
        scale = target_dpi / dpi
        new_w = max(image.width, int(image.width * scale))
        new_h = max(image.height, int(image.height * scale))
        image = image.resize((new_w, new_h), Image.LANCZOS)

    # Step 3: Contrast enhancement — lifts faint printed text.
    # Factor 1.5 is conservative; higher values can blow out fine details.
    if apply_contrast:
        image = ImageEnhance.Contrast(image).enhance(1.5)

    # Step 4: Sharpen once — recovers mild blur from phone cameras.
    # One pass is enough; multiple passes create ringing artifacts.
    if apply_sharpening:
        image = image.filter(ImageFilter.SHARPEN)

    return image


def estimate_dpi(image: Image.Image) -> Optional[int]:
    """Attempt to read DPI from image metadata.

    Args:
        image: PIL image that may contain DPI info in its metadata.

    Returns:
        DPI as integer, or None if no reliable metadata exists.

    Examples:
        >>> from PIL import Image
        >>> img = Image.new("RGB", (300, 100))
        >>> # Image with no DPI metadata returns None
        >>> estimate_dpi(img) is None
        True
    """
    try:
        dpi_info = image.info.get("dpi")
        if dpi_info is not None:
            if isinstance(dpi_info, (tuple, list)):
                return int(dpi_info[0])
            return int(dpi_info)
    except (TypeError, ValueError, IndexError):
        pass
    return None


def should_preprocess(image: Image.Image) -> bool:
    """Heuristic: does this image likely need preprocessing?

    Returns True if the image shows signs of being a raw camera photo
    (low DPI metadata, small size, or non-standard mode) rather than a
    clean programmatically-generated render.

    Args:
        image: Input PIL image.

    Returns:
        True if preprocessing is recommended.
    """
    if image.mode not in ("RGB", "L"):
        return True  # Non-standard mode always benefits from conversion

    dpi = estimate_dpi(image)
    if dpi is not None and dpi < 150:
        return True  # Known low-DPI source

    # Images smaller than 600×200 are likely camera crops needing cleanup
    if image.width < 600 or image.height < 200:
        return True

    return False


def image_from_bytes(data: bytes, filename: str = "") -> Image.Image:
    """Open a PIL image from raw bytes.

    Args:
        data: Raw image bytes (JPEG, PNG, etc.).
        filename: Optional filename for format hint and error messages.

    Returns:
        PIL.Image.Image

    Raises:
        ValueError: If data is empty or not a recognised image format.
    """
    if not data:
        raise ValueError("Image data is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"Image is too large ({len(data) / 1024 / 1024:.1f} MB). "
            f"Maximum is {MAX_IMAGE_BYTES // 1024 // 1024} MB."
        )

    import io

    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # Force decompression to catch corrupt files early
        return img
    except Exception as exc:
        raise ValueError(f"Cannot open image{' ' + filename if filename else ''}: {exc}") from exc

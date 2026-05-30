#!/usr/bin/env python3
"""Generate synthetic test images for pix2tex OCR testing.

Creates datasets/test_images/ with clean math equation images at
various qualities. These are used as test fixtures — not for benchmarking
real OCR accuracy (use actual textbook photos for that).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = Path(__file__).parent.parent / "datasets" / "test_images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Try to use a monospace font — fall back to default if not available
def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in [
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/System/Library/Fonts/Courier.ttc",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/consola.ttf",
    ]:
        try:
            return ImageFont.truetype(font_path, size)
        except (OSError, AttributeError):
            continue
    return ImageFont.load_default()


def make_equation_image(
    equation: str,
    filename: str,
    width: int = 800,
    height: int = 150,
    font_size: int = 48,
    dpi: int = 300,
    bg: str = "white",
    fg: str = "black",
) -> Path:
    """Create a clean image of a math equation."""
    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)
    font = _get_font(font_size)

    # Center the text
    try:
        bbox = draw.textbbox((0, 0), equation, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except AttributeError:
        tw, th = draw.textsize(equation, font=font)

    x = (width - tw) // 2
    y = (height - th) // 2
    draw.text((x, y), equation, fill=fg, font=font)

    # Embed DPI metadata
    out_path = OUTPUT_DIR / filename
    img.save(out_path, dpi=(dpi, dpi))
    return out_path


def main() -> None:
    print(f"Generating test images in {OUTPUT_DIR}/")

    images = [
        # (equation_text, filename, width, height, font_size, dpi)
        ("x + 2 = 5",         "eq_simple.png",    600, 120,  52, 300),
        ("a/b = c",           "eq_fraction.png",  600, 120,  52, 300),
        ("x^2 + 3x + 2 = 0",  "eq_quadratic.png", 800, 140,  48, 300),
        ("sqrt(x+1) = 3",      "eq_sqrt.png",      700, 120,  48, 300),
        ("x + 2 = 5",         "eq_lowdpi.png",    600, 120,  52,  72),  # Low DPI version
        ("f(x) = 2x + 1",     "eq_function.png",  700, 130,  48, 300),
        ("a^2 + b^2 = c^2",   "eq_pythagoras.png",800, 140,  48, 300),
    ]

    for eq, fname, w, h, fs, dpi in images:
        path = make_equation_image(eq, fname, width=w, height=h, font_size=fs, dpi=dpi)
        print(f"  {fname:30s} ({dpi} DPI, {w}x{h}px)")

    print(f"\nCreated {len(images)} test images in {OUTPUT_DIR}")
    print("Use these with POST /ocr/image for manual smoke testing.")


if __name__ == "__main__":
    main()

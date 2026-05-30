#!/usr/bin/env python3
"""Generate ground-truth math equation images for OCR benchmarking.

Renders LaTeX expressions to PNG using matplotlib's built-in mathtext engine
(no system LaTeX install needed). Each render is a (ground_truth_latex, image)
pair, which lets ocr_benchmark.py measure pix2tex accuracy objectively.

Images are written to datasets/test_images/real/ and a manifest.json records
the ground-truth LaTeX, category, and DPI for each file.

These are SYNTHETIC ground-truth fixtures. They are cleaner than phone photos
of a textbook, so the accuracy measured here is an UPPER BOUND on real-world
performance — useful for relative comparison (which categories/DPIs fail) and
for a reproducible regression baseline.

Usage:
    python scripts/generate_benchmark_images.py
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless backend
import matplotlib.pyplot as plt

OUTPUT_DIR = Path(__file__).parent.parent / "datasets" / "test_images" / "real"

# (name, latex, category, dpi)
# Categories: linear, quadratic, fraction, radical, trig.
# DPI variants (72 bad / 150 medium / 300 good) probe resolution sensitivity.
SPECS: list[tuple[str, str, str, int]] = [
    # --- linear (5) ---
    ("linear_2x3_300", r"2x + 3 = 7", "linear", 300),
    ("linear_axbc_300", r"ax + b = c", "linear", 300),
    ("linear_xhalf_300", r"\frac{x}{2} = 4", "linear", 300),
    ("linear_3x5_150", r"3x - 5 = 10", "linear", 150),
    ("linear_2x3_72", r"2x + 3 = 7", "linear", 72),
    # --- quadratic (5) ---
    ("quad_x2_3x2_300", r"x^2 + 3x + 2 = 0", "quadratic", 300),
    ("quad_abc_300", r"ax^2 + bx + c = 0", "quadratic", 300),
    ("quad_x2m4_300", r"x^2 - 4 = 0", "quadratic", 300),
    ("quad_2x2_150", r"2x^2 + 5x - 3 = 0", "quadratic", 150),
    ("quad_x2_3x2_72", r"x^2 + 3x + 2 = 0", "quadratic", 72),
    # --- fraction (4) ---
    ("frac_abcd_300", r"\frac{a}{b} = \frac{c}{d}", "fraction", 300),
    ("frac_3412_300", r"\frac{3}{4} + \frac{1}{2}", "fraction", 300),
    ("frac_x2_300", r"\frac{x}{2} = \frac{6}{4}", "fraction", 300),
    ("frac_3412_72", r"\frac{3}{4} + \frac{1}{2}", "fraction", 72),
    # --- radical (3) ---
    ("rad_sqrt_300", r"\sqrt{x + 1} = 3", "radical", 300),
    ("rad_circle_300", r"x^2 + y^2 = r^2", "radical", 300),
    ("rad_sqrt2_150", r"\sqrt{2x} = 4", "radical", 150),
    # --- trig (3) ---
    ("trig_sincos_300", r"\sin\theta + \cos\theta = 1", "trig", 300),
    ("trig_tan_300", r"\tan\theta = \frac{1}{2}", "trig", 300),
    ("trig_sin2_150", r"\sin 2x = 0", "trig", 150),
]


def render(name: str, latex: str, dpi: int) -> Path:
    """Render a LaTeX string to a white-background PNG at the given DPI."""
    # Fixed figsize with NO tight-cropping → deterministic pixel size = figsize*dpi.
    # This keeps even 72-DPI renders (432x144) above the preprocessor's 100px
    # minimum, so DPI varies image *quality*, not whether it's processable.
    fig = plt.figure(figsize=(6, 2))
    fig.text(
        0.5, 0.5, f"${latex}$",
        fontsize=28, ha="center", va="center",
    )
    out = OUTPUT_DIR / f"{name}.png"
    fig.savefig(out, dpi=dpi, facecolor="white")
    plt.close(fig)
    return out


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    print(f"Rendering {len(SPECS)} benchmark images to {OUTPUT_DIR}/")
    for name, latex, category, dpi in SPECS:
        path = render(name, latex, dpi)
        manifest.append({
            "file": path.name,
            "ground_truth": latex,
            "category": category,
            "dpi": dpi,
        })
        print(f"  {path.name:24s} [{category:9s} {dpi} DPI]  {latex}")

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(manifest)} entries to {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Measure pix2tex OCR accuracy against ground-truth equation images.

Reads datasets/test_images/real/manifest.json (produced by
generate_benchmark_images.py), runs each image through the real OCR pipeline
(preprocess -> pix2tex), compares the output LaTeX to the known ground truth,
and writes a markdown report to docs/ocr-benchmark-results.md.

Metrics per image:
    exact_match    — normalized strings equal (whitespace/delimiters ignored)
    similarity     — difflib ratio of normalized strings (0..1)
    inference_ms   — pix2tex wallclock time
    confidence     — ocr_service heuristic confidence

Modes:
    (default)  real pix2tex — downloads ~1.5 GB model on first run, CPU is slow
    --mock     echoes ground truth (validates the harness without the model)
    --limit N  only run the first N images (quick smoke)

Usage:
    python scripts/ocr_benchmark.py --mock
    python scripts/ocr_benchmark.py            # real run
"""

import argparse
import json
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image

from backend.services import ocr_service as ocr_module
from backend.services.image_preprocessor import preprocess_for_ocr
from backend.services.ocr_service import OCRResult

ROOT = Path(__file__).parent.parent
IMG_DIR = ROOT / "datasets" / "test_images" / "real"
MANIFEST = IMG_DIR / "manifest.json"
REPORT = ROOT / "docs" / "ocr-benchmark-results.md"


def normalize_latex(s: str) -> str:
    """Strict normalization: drop whitespace and cosmetic spacing tokens."""
    if not s:
        return ""
    for token in ("$", r"\left", r"\right", r"\,", r"\;", r"\!", " ", "\t", "\n"):
        s = s.replace(token, "")
    return s


def normalize_lenient(s: str) -> str:
    """Lenient normalization: also case-fold and strip braces / leading backslash.

    pix2tex's dominant errors on clean renders are cosmetic: it uppercases
    italic variables (x -> X) and wraps subexpressions in redundant braces.
    Lenient match measures whether the result is the SAME EQUATION modulo these.
    """
    s = normalize_latex(s).lower()
    for token in ("{", "}", r"\!"):
        s = s.replace(token, "")
    return s.lstrip("\\")


def _difflib_ratio(a: str, b: str) -> float:
    import difflib
    return difflib.SequenceMatcher(None, a, b).ratio()


class _MockModel:
    """Returns ground truth verbatim — validates the harness, not accuracy."""

    def __init__(self, manifest):
        self._by_file = {m["file"]: m["ground_truth"] for m in manifest}
        self.current_file = ""

    def __call__(self, image):
        return self._by_file.get(self.current_file, "")


def run() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mock", action="store_true", help="echo ground truth (no model)")
    ap.add_argument("--limit", type=int, default=0, help="run only first N images")
    args = ap.parse_args()

    if not MANIFEST.exists():
        print("manifest.json missing. Run scripts/generate_benchmark_images.py first.")
        return 1
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if args.limit:
        manifest = manifest[: args.limit]

    service = ocr_module.ocr_service
    mock = None
    if args.mock:
        mock = _MockModel(manifest)
        service._model = mock
        service._model_available = True

    print(f"Running OCR benchmark on {len(manifest)} images "
          f"({'MOCK' if args.mock else 'REAL pix2tex'})...")

    rows = []
    for m in manifest:
        img_path = IMG_DIR / m["file"]
        gt = m["ground_truth"]
        if mock:
            mock.current_file = m["file"]
        try:
            image = Image.open(img_path)
            image = preprocess_for_ocr(image)
            result: OCRResult = service.extract_latex_from_image(image, preprocess=False)
        except Exception as exc:  # harness must not crash mid-run
            result = OCRResult(False, None, 0.0, False, 0.0, error=str(exc))

        out = result.latex or ""
        n_gt, n_out = normalize_latex(gt), normalize_latex(out)
        exact = n_gt == n_out and bool(n_out)
        lenient = normalize_lenient(gt) == normalize_lenient(out) and bool(out)
        sim = _difflib_ratio(n_gt, n_out)
        rows.append({
            **m, "output": out, "exact": exact, "lenient": lenient, "similarity": sim,
            "ms": result.inference_time_ms, "confidence": result.confidence,
        })
        flag = "OK " if exact else f"~{sim:.2f}"
        print(f"  {m['file']:24s} {flag}  gt={gt!r} out={out!r}")

    _write_report(rows, real=not args.mock)
    n_exact = sum(r["exact"] for r in rows)
    print(f"\nExact match: {n_exact}/{len(rows)} ({100*n_exact/len(rows):.0f}%)")
    print(f"Report: {REPORT}")
    return 0


def _write_report(rows: list[dict], real: bool) -> None:
    n = len(rows)
    n_exact = sum(r["exact"] for r in rows)
    n_lenient = sum(r["lenient"] for r in rows)
    mean_sim = statistics.mean(r["similarity"] for r in rows) if rows else 0.0
    timed = [r["ms"] for r in rows if r["ms"] > 0]
    mean_ms = statistics.mean(timed) if timed else 0.0

    by_cat: dict[str, list[dict]] = defaultdict(list)
    by_dpi: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r)
        by_dpi[r["dpi"]].append(r)

    def rate(group: list[dict]) -> str:
        e = sum(g["exact"] for g in group)
        return f"{e}/{len(group)} ({100*e/len(group):.0f}%)"

    lines = [
        "# OCR Benchmark Results",
        "",
        f"**Mode:** {'REAL pix2tex (CPU)' if real else 'MOCK (harness validation only)'}  ",
        f"**Images:** {n} synthetic ground-truth renders (matplotlib mathtext)  ",
        "**Source:** `scripts/ocr_benchmark.py` over `datasets/test_images/real/`  ",
        "",
        "> Synthetic renders are cleaner than phone photos, so these numbers are an "
        "**upper bound** on real-world accuracy. They are most useful for *relative* "
        "comparison across categories and DPI, and as a reproducible regression baseline.",
        "",
        "## Summary",
        "",
        f"- **Strict exact match:** {n_exact}/{n} ({100*n_exact/n:.0f}%) "
        "— byte-identical after whitespace normalization",
        f"- **Lenient exact match:** {n_lenient}/{n} ({100*n_lenient/n:.0f}%) "
        "— same equation after case-folding + brace-stripping (the dominant pix2tex "
        "errors on clean renders are `x`->`X` and redundant braces)",
        f"- **Mean character similarity:** {mean_sim:.2f}",
        f"- **Mean inference time:** {mean_ms:.0f} ms" + (" (CPU)" if real else " (mock)"),
        "",
        "### By category",
        "",
        "| Category | Exact match |",
        "|----------|-------------|",
    ]
    for cat in sorted(by_cat):
        lines.append(f"| {cat} | {rate(by_cat[cat])} |")
    lines += ["", "### By DPI", "", "| DPI | Exact match |", "|-----|-------------|"]
    for dpi in sorted(by_dpi):
        lines.append(f"| {dpi} | {rate(by_dpi[dpi])} |")

    lines += [
        "", "## Per-image", "",
        "| Image | Category | DPI | Ground truth | pix2tex output | Exact | Sim | Time(ms) | Conf |",
        "|-------|----------|-----|--------------|----------------|-------|-----|----------|------|",
    ]
    for r in rows:
        lines.append(
            f"| {r['file']} | {r['category']} | {r['dpi']} | `{r['ground_truth']}` | "
            f"`{r['output']}` | {'yes' if r['exact'] else 'no'} | {r['similarity']:.2f} | "
            f"{r['ms']:.0f} | {r['confidence']:.2f} |"
        )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(run())

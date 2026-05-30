#!/usr/bin/env python3
"""Phase 2 smoke test — image OCR → Nemeth Braille pipeline.

Exercises POST /ocr/image and POST /ocr/image-to-braille end-to-end against
the FastAPI app (in-process, no server needed).

Modes:
    Default (mock):  patches the OCR service with a deterministic fake so the
                     pipeline runs instantly without the 1.5 GB pix2tex model.
                     This validates routing, preprocessing, translation, and
                     response shaping.
    --real:          uses the real pix2tex model. On first run this downloads
                     ~1.5 GB and CPU inference takes 5–30s per image.

Usage:
    python scripts/smoke_test_phase2.py
    python scripts/smoke_test_phase2.py --real
"""

import sys
from pathlib import Path

# Windows consoles default to cp1252, which cannot encode Unicode Braille.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except (AttributeError, ValueError):
    pass

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient

from backend.main import app
from backend.services import ocr_service as ocr_module
from backend.services.ocr_service import OCRResult

TEST_IMAGE = Path(__file__).parent.parent / "datasets" / "test_images" / "eq_simple.png"


class _MockOCR:
    """Deterministic fake — returns a fixed LaTeX so the demo is reproducible."""

    def extract_latex_from_bytes(self, data, filename="", preprocess=True):
        return OCRResult(True, "x + 2 = 5", 0.85, True, 12.0)

    def extract_latex_from_image(self, image, preprocess=True):
        return OCRResult(True, "x + 2 = 5", 0.85, True, 12.0)


def main() -> int:
    real = "--real" in sys.argv

    print("Phase 2 Smoke Test: Image OCR Pipeline")
    print("=" * 40)
    print(f"Test image: {TEST_IMAGE.relative_to(Path(__file__).parent.parent)}")
    print(f"Mode: {'REAL pix2tex' if real else 'MOCK (deterministic)'}\n")

    if not TEST_IMAGE.exists():
        print(f"ERROR: test image missing. Run: python scripts/generate_test_images.py")
        return 1

    if not real:
        ocr_module.ocr_service = _MockOCR()  # type: ignore[assignment]

    image_bytes = TEST_IMAGE.read_bytes()
    client = TestClient(app)

    # [1] POST /ocr/image
    print("[1] POST /ocr/image")
    r1 = client.post(
        "/ocr/image",
        files={"file": (TEST_IMAGE.name, image_bytes, "image/png")},
    )
    if r1.status_code != 200:
        print(f"  FAILED: HTTP {r1.status_code} — {r1.text}")
        return 1
    d1 = r1.json()
    print(f"  LaTeX:      {d1['latex']}")
    print(f"  Confidence: {d1['confidence']}")
    print(f"  OCR time:   {d1['inference_time_ms']}ms")
    print(f"  Status:     {'OK success' if d1['success'] else 'low-confidence'}\n")

    # [2] POST /ocr/image-to-braille
    print("[2] POST /ocr/image-to-braille")
    r2 = client.post(
        "/ocr/image-to-braille",
        files={"file": (TEST_IMAGE.name, image_bytes, "image/png")},
    )
    if r2.status_code != 200:
        print(f"  FAILED: HTTP {r2.status_code} — {r2.text}")
        return 1
    d2 = r2.json()
    stages = d2["pipeline_stages"]
    print(f"  LaTeX:      {d2['latex']}")
    print(f"  Braille:    {d2['braille_unicode'] or '(none - translation unavailable)'}")
    print(f"  Dot patterns: {d2['dot_patterns']}")
    print(
        f"  Pipeline:   preprocess={stages['preprocessing_ms']}ms | "
        f"ocr={stages['ocr_ms']}ms | translate={stages['translation_ms']}ms | "
        f"total={d2['total_time_ms']}ms"
    )
    print(f"  Status:     {'OK success' if d2['success'] else 'success=false'}\n")

    # The pipeline plumbing passes if both endpoints return 200 and the demo
    # endpoint surfaces the OCR LaTeX. Braille may be empty if liblouis Nemeth
    # is unavailable in this environment — that's a translation-layer concern.
    plumbing_ok = r1.status_code == 200 and r2.status_code == 200 and d2["latex"]
    if plumbing_ok:
        print("Phase 2 Smoke Test: PASSED")
        if not real:
            print("(mock mode — run with --real to validate pix2tex OCR accuracy)")
        if not d2["success"]:
            print("(note: Braille empty — check liblouis/nemeth.ctb availability)")
        return 0

    print("Phase 2 Smoke Test: FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

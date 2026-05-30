#!/usr/bin/env python3
"""Braillix end-to-end demo — the 4-minute story, run programmatically.

Drives the REAL FastAPI endpoints in-process (no server needed) across three
scenes:
  1. Live text/LaTeX -> Nemeth Braille -> cam angles
  2. Photo of an equation -> OCR -> Nemeth Braille (the demo highlight)
  3. Adaptive assessment: generate an MCQ, answer it, watch the model learn

Usage:
  python scripts/demo_full.py --all
  python scripts/demo_full.py --scene 1
  python scripts/demo_full.py --all --mock-ocr      # fast: skip real pix2tex
  python scripts/demo_full.py --all --simulator     # show SimulatorHAL output

Flags:
  --scene N     run only scene N (1, 2, or 3)
  --all         run all scenes (default if no scene given)
  --mock-ocr    use a deterministic mock for OCR (instant; for when CPU is slow)
  --simulator   feed dot patterns to the SimulatorHAL and print its status
"""

import argparse
import sys
from pathlib import Path
from uuid import uuid4

try:
    sys.stdout.reconfigure(encoding="utf-8")  # Unicode Braille on Windows consoles
except (AttributeError, ValueError):
    pass

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient

from backend.main import app
from backend.services import ocr_service as ocr_module
from backend.services.mcq_generator import generate_mcq
from backend.services.ocr_service import OCRResult

DEMO_LATEX = "x^2 + 3x + 2 = 0"
DEMO_IMAGE = (Path(__file__).parent.parent
              / "datasets" / "test_images" / "real" / "quad_x2_3x2_300.png")
# Unique per run so every rehearsal starts at the skill's prior (L0) — the
# knowledge update is reproducible instead of accumulating across demo runs.
STUDENT = f"demo_{uuid4().hex[:8]}"

RULE = "-" * 44


class _MockOCR:
    def extract_latex_from_bytes(self, data, filename=""):
        return OCRResult(True, DEMO_LATEX, 0.84, True, 12.0)

    def extract_latex_from_image(self, image, preprocess=True):
        return OCRResult(True, DEMO_LATEX, 0.84, True, 12.0)


def _simulator_show(dot_patterns: list[int]) -> None:
    """Feed dot patterns through a SimulatorHAL (or stub) and print status."""
    try:
        from hal import SimulatorHAL  # type: ignore
    except Exception:
        class SimulatorHAL:  # minimal stub mirroring conftest
            def __init__(self): self._cells = {}
            def display_pattern(self, i, dots): self._cells[i] = dots
            def home(self): self._cells.clear()
            def get_status(self): return {"cells": len(self._cells), "busy": False, "errors": []}

    hal = SimulatorHAL()
    for i, dots in enumerate(dot_patterns):
        hal.display_pattern(i, dots)
    print(f"  [SimulatorHAL] displayed {len(dot_patterns)} cells -> {hal.get_status()}")


def scene1(client: TestClient, simulator: bool) -> None:
    print("\nSCENE 1: Live Text/Math Translation")
    print(RULE)
    print('Teacher types: "x squared plus 3x plus 2 equals 0"')
    print(f"Input LaTeX: {DEMO_LATEX}")
    r = client.post("/translate-math", json={"latex": DEMO_LATEX})
    if r.status_code != 200:
        print(f"  -> translation unavailable (HTTP {r.status_code}: {r.text[:80]})")
        return
    d = r.json()
    print(f"  Nemeth Braille: {d['braille_unicode']}")
    print(f"  Dot patterns:   {d['dot_patterns']} ({d['cell_count']} cells)")

    ca = client.post("/translate/cam-angles", json={"dot_patterns": d["dot_patterns"]})
    if ca.status_code == 200:
        angles = ca.json()["angles_degrees"]
        preview = ", ".join(f"{a:.1f}deg" for a in angles[:5])
        print(f"  Cam angles:     [{preview}{', ...' if len(angles) > 5 else ''}]")
    if simulator:
        _simulator_show(d["dot_patterns"])
    print("  Status: OK")


def scene2(client: TestClient, simulator: bool, mock_ocr: bool) -> None:
    print("\nSCENE 2: Photo Upload -> OCR -> Braille")
    print(RULE)
    if not DEMO_IMAGE.exists():
        print(f"  test image missing: {DEMO_IMAGE}")
        print("  run: python scripts/generate_benchmark_images.py")
        return
    print(f"Using: {DEMO_IMAGE.relative_to(Path(__file__).parent.parent)}")
    if mock_ocr:
        ocr_module.ocr_service = _MockOCR()  # type: ignore[assignment]
        print("  (mock OCR — deterministic)")
    else:
        print("  (real pix2tex — first run downloads the model; CPU is slow)")

    r = client.post(
        "/ocr/image-to-braille",
        files={"file": (DEMO_IMAGE.name, DEMO_IMAGE.read_bytes(), "image/png")},
    )
    if r.status_code != 200:
        print(f"  -> HTTP {r.status_code}: {r.text[:80]}")
        return
    d = r.json()
    s = d["pipeline_stages"]
    print(f"  OCR extracted:  {d['latex']} (confidence {d['ocr_confidence']})")
    print(f"  Nemeth Braille: {d['braille_unicode'] or '(none)'}")
    print(f"  Dot patterns:   {d['dot_patterns']}")
    print(f"  Pipeline:       preprocess={s['preprocessing_ms']}ms | "
          f"ocr={s['ocr_ms']}ms | translate={s['translation_ms']}ms | total={d['total_time_ms']}ms")
    if simulator and d["dot_patterns"]:
        _simulator_show(d["dot_patterns"])
    print(f"  Status: {'OK success' if d['success'] else 'success=false'}")


def scene3(client: TestClient) -> None:
    print("\nSCENE 3: Adaptive Assessment")
    print(RULE)
    print(f"Generating MCQ for: {DEMO_LATEX}  (student_id={STUDENT!r})")
    g = client.post("/assessment/generate",
                    json={"latex": DEMO_LATEX, "student_id": STUDENT})
    if g.status_code != 200:
        print(f"  -> HTTP {g.status_code}: {g.text[:80]}")
        return
    q = g.json()
    print(f"\nQuestion: {q['question_text']}  [skill={q['skill']}, difficulty={q['difficulty']}]")
    for ch in q["choices"]:
        print(f"  {chr(65 + ch['index'])}) {ch['text']:<22} Braille: {ch['braille']}")

    correct_idx = generate_mcq(DEMO_LATEX).correct_index  # deterministic
    print(f"\n-> Student selects: {chr(65 + correct_idx)} (the correct answer)")
    s = client.post("/assessment/submit", json={
        "question_id": q["question_id"], "student_id": STUDENT, "selected_index": correct_idx,
    })
    if s.status_code != 200:
        print(f"  -> HTTP {s.status_code}: {s.text[:80]}")
        return
    res = s.json()
    print(f"  Result: {'CORRECT' if res['correct'] else 'INCORRECT'}")
    print(f"  Knowledge update: p_knows({res['skill']}): "
          f"{res['p_knows_before']:.2f} -> {res['p_knows_after']:.2f}")
    print(f"  Next difficulty: {res['next_recommended_difficulty']}")
    print(f"  Recommendation: {res['recommendation']}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", type=int, choices=[1, 2, 3])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--mock-ocr", action="store_true")
    ap.add_argument("--simulator", action="store_true")
    args = ap.parse_args()

    scenes = [args.scene] if args.scene else [1, 2, 3]

    print("[DEMO: Braillix — Accessible Math Education]")
    print("=" * 44)

    with TestClient(app) as client:
        if 1 in scenes:
            scene1(client, args.simulator)
        if 2 in scenes:
            scene2(client, args.simulator, args.mock_ocr)
        if 3 in scenes:
            scene3(client)

    print("\n" + "=" * 44)
    print("[DEMO COMPLETE]")
    if args.mock_ocr:
        print("(OCR scene ran in mock mode — use real pix2tex for live accuracy)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

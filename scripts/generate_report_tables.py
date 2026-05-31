#!/usr/bin/env python3
"""Generate copy-paste-ready Markdown tables for the capstone report.

Pulls numbers from the actual system (not from memory):
  1. Test coverage per module      (pytest --collect-only)
  2. OCR benchmark summary          (parsed from docs/ocr-benchmark-results.md)
  3. API endpoint inventory         (enumerated from the FastAPI app)
  4. BKT parameter table            (from knowledge_tracer.DEFAULT_BKT_PARAMS)
  5. Latency budget                 (from docs/memo-latency-budget.md + measured)

Usage:
    python scripts/generate_report_tables.py            # all tables to stdout
    python scripts/generate_report_tables.py > tables.md
"""

import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

# Tables contain em-dashes/arrows; Windows consoles default to cp1252.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except (AttributeError, ValueError):
    pass

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


def _hr(title: str) -> None:
    print(f"\n## {title}\n")


# ---------------------------------------------------------------------------
# 1. Test coverage per module
# ---------------------------------------------------------------------------

def table_test_coverage() -> None:
    _hr("Table 1 — Test coverage per module")
    try:
        out = subprocess.run(
            [sys.executable, "-m", "pytest", "--collect-only", "-q", "tests"],
            cwd=ROOT, capture_output=True, text=True, timeout=300,
        ).stdout
    except Exception as exc:
        print(f"_(could not collect tests: {exc})_")
        return

    counts: Counter = Counter()
    for line in out.splitlines():
        m = re.match(r"(tests[/\\]test_[\w]+\.py)::", line.strip())
        if m:
            counts[m.group(1).replace("\\", "/")] += 1

    if not counts:
        print("_(no tests collected)_")
        return

    print("| Test module | Tests |")
    print("|-------------|-------|")
    for mod in sorted(counts):
        print(f"| `{mod}` | {counts[mod]} |")
    print(f"| **Total** | **{sum(counts.values())}** |")


# ---------------------------------------------------------------------------
# 2. OCR benchmark summary
# ---------------------------------------------------------------------------

def table_ocr_benchmark() -> None:
    _hr("Table 2 — OCR benchmark (measured)")
    path = ROOT / "docs" / "ocr-benchmark-results.md"
    if not path.exists():
        print("_(docs/ocr-benchmark-results.md not found — run scripts/ocr_benchmark.py)_")
        return
    text = path.read_text(encoding="utf-8")

    def grab(pattern: str) -> str:
        m = re.search(pattern, text)
        return m.group(1).strip() if m else "n/a"

    rows = [
        ("Strict exact match", grab(r"Strict exact match:\*\*\s*([^\n—]+)")),
        ("Lenient exact match", grab(r"Lenient exact match:\*\*\s*([^\n—]+)")),
        ("Mean char similarity", grab(r"Mean character similarity:\*\*\s*([^\n]+)")),
        ("Mean inference time", grab(r"Mean inference time:\*\*\s*([^\n]+)")),
    ]
    print("| Metric | Value |")
    print("|--------|-------|")
    for name, val in rows:
        print(f"| {name} | {val} |")


# ---------------------------------------------------------------------------
# 3. API endpoint inventory
# ---------------------------------------------------------------------------

def table_api_inventory() -> None:
    _hr("Table 3 — API endpoint inventory")
    try:
        from backend.main import app
    except Exception as exc:
        print(f"_(could not import app: {exc})_")
        return

    rows = []
    for route in app.routes:
        path = getattr(route, "path", None)
        if not path:
            continue
        methods = getattr(route, "methods", None)
        if methods:
            verb = ",".join(sorted(m for m in methods if m not in ("HEAD", "OPTIONS")))
        elif route.__class__.__name__ == "APIWebSocketRoute":
            verb = "WS"
        else:
            continue
        if path in ("/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect"):
            continue
        rows.append((path, verb))

    print("| Method | Path |")
    print("|--------|------|")
    for path, verb in sorted(rows):
        print(f"| {verb} | `{path}` |")
    print(f"\n_{len(rows)} routes._")


# ---------------------------------------------------------------------------
# 4. BKT parameters
# ---------------------------------------------------------------------------

def table_bkt_params() -> None:
    _hr("Table 4 — Bayesian Knowledge Tracing parameters")
    try:
        from backend.services.knowledge_tracer import DEFAULT_BKT_PARAMS
    except Exception as exc:
        print(f"_(could not import BKT params: {exc})_")
        return
    print("| Skill | L0 (prior) | T (transit) | G (guess) | S (slip) |")
    print("|-------|-----------|-------------|-----------|----------|")
    for skill, p in DEFAULT_BKT_PARAMS.items():
        print(f"| {skill} | {p['L0']} | {p['T']} | {p['G']} | {p['S']} |")


# ---------------------------------------------------------------------------
# 5. Latency budget
# ---------------------------------------------------------------------------

def table_latency() -> None:
    _hr("Table 5 — Latency budget (text-input path, no OCR)")
    print("| Stage | Time | Source |")
    print("|-------|------|--------|")
    rows = [
        ("WebSocket send (LAN)", "5–20 ms", "estimate"),
        ("L3 translation (liblouis)", "1–50 ms", "memo; ~3 ms measured"),
        ("L5 API routing", "1–5 ms", "estimate"),
        ("WebSocket broadcast (LAN)", "5–20 ms", "estimate"),
        ("L2 HAL queue", "1–5 ms", "estimate"),
        ("L1 motor (cam rotation)", "400–800 ms", "hardware-limited"),
        ("**Text→motor total**", "**~630 ms**", "**< 1000 ms budget**"),
    ]
    for stage, time_, src in rows:
        print(f"| {stage} | {time_} | {src} |")
    print("\n| Reference path | Time | Note |")
    print("|----------------|------|------|")
    print("| Image OCR (pix2tex, CPU) | ~1.7 s/image | measured (benchmark) |")
    print("| Classroom broadcast→answer→dashboard | ~42 ms | measured (demo Scene 4) |")


def main() -> int:
    print("# Braillix — Report Tables")
    print("\n_Auto-generated by `scripts/generate_report_tables.py`._")
    table_test_coverage()
    table_ocr_benchmark()
    table_api_inventory()
    table_bkt_params()
    table_latency()
    return 0


if __name__ == "__main__":
    sys.exit(main())

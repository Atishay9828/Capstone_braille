#!/usr/bin/env python3
"""Phase 0 end-to-end smoke test.

Demonstrates the full pipeline:
    text → liblouis → Braille dot patterns → cam angles → SimulatorHAL

Run with:
    python3 scripts/smoke_test.py
"""

import sys
import io
from pathlib import Path

# Force UTF-8 output so Unicode Braille characters and ✓/✗ render correctly
# on Windows terminals that default to cp1252.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Allow running from the project root without installing the package.
sys.path.insert(0, str(Path(__file__).parent.parent))

SEPARATOR = "-" * 60


def section(title: str) -> None:
    print(f"\n{SEPARATOR}")
    print(f"  {title}")
    print(SEPARATOR)


# ---------------------------------------------------------------------------
# Step 1 — Import all modules
# ---------------------------------------------------------------------------
section("Step 1: Importing modules")

try:
    from backend.services.translator import (
        BrailleGrade,
        _LOUIS_AVAILABLE,
        check_tables_available,
        translate_text,
    )
    print("  ✓ backend.services.translator")
except Exception as exc:
    print(f"  ✗ backend.services.translator — {exc}")
    sys.exit(1)

try:
    from backend.services.cam_angles import (
        braille_sequence_to_angles,
        pattern_to_angle,
    )
    print("  ✓ backend.services.cam_angles")
except Exception as exc:
    print(f"  ✗ backend.services.cam_angles — {exc}")
    sys.exit(1)

try:
    from hal import SimulatorHAL
    print("  ✓ hal.SimulatorHAL")
except Exception as exc:
    print(f"  ✗ hal.SimulatorHAL — {exc}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Step 2 — Check liblouis availability
# ---------------------------------------------------------------------------
section("Step 2: liblouis status")

if _LOUIS_AVAILABLE:
    import louis  # type: ignore[import-untyped]
    print(f"  ✓ liblouis available — version {louis.version()}")
    tables = check_tables_available()
    for name, available in tables.items():
        mark = "✓" if available else "✗"
        print(f"  {mark} table: {name}")
    DEMO_MODE = False
else:
    print("  ⚠ liblouis NOT installed — running in demo mode")
    print("    Install with: bash scripts/setup.sh")
    DEMO_MODE = True

# ---------------------------------------------------------------------------
# Step 3 — Translate "hi" → Braille dot patterns
# ---------------------------------------------------------------------------
section('Step 3: Translate "hi" → Braille dot patterns')

if not DEMO_MODE:
    result = translate_text("hi", BrailleGrade.GRADE_1)
    dot_patterns = result.dot_patterns
    braille_unicode = result.braille_unicode
    print(f"  Input       : {result.input_text!r}")
    print(f"  Grade       : {result.grade.value}")
    print(f"  Braille     : {braille_unicode}")
    print(f"  Dot patterns: {dot_patterns}")
    print(f"  Cell count  : {result.cell_count}")
else:
    # Hardcoded demo values for h=37, i=5 when liblouis is not installed.
    dot_patterns = [37, 5]
    braille_unicode = "".join(chr(0x2800 + p) for p in dot_patterns)
    print(f"  Input       : 'hi'  (demo mode)")
    print(f"  Dot patterns: {dot_patterns}  (hardcoded — install liblouis for real values)")
    print(f"  Braille     : {braille_unicode}")

# ---------------------------------------------------------------------------
# Step 4 — Convert dot patterns → cam angles
# ---------------------------------------------------------------------------
section("Step 4: Dot patterns → cam angles")

angles = braille_sequence_to_angles(dot_patterns)
for idx, (pattern, angle) in enumerate(zip(dot_patterns, angles)):
    print(
        f"  Cell {idx}: pattern {pattern:2d} (0b{pattern:06b}) → {angle:.3f}°"
    )

# ---------------------------------------------------------------------------
# Step 5 — Send to SimulatorHAL
# ---------------------------------------------------------------------------
section("Step 5: SimulatorHAL output")

hal = SimulatorHAL(num_cells=8)
hal.display_string(dot_patterns)
print()
status = hal.get_status()
print(f"  Status: {status}")

# ---------------------------------------------------------------------------
# Step 6 — Bonus: "hello world" (liblouis only)
# ---------------------------------------------------------------------------
if not DEMO_MODE:
    section('Step 6: Bonus — "hello world"')
    hw_result = translate_text("hello world", BrailleGrade.GRADE_1)
    hw_angles = braille_sequence_to_angles(hw_result.dot_patterns)
    print(f"  Input      : {hw_result.input_text!r}")
    print(f"  Cell count : {hw_result.cell_count}")
    print(f"  Dot patterns (first 5): {hw_result.dot_patterns[:5]}...")
    print(f"  Angles (first 5)      : {[round(a, 3) for a in hw_angles[:5]]}...")
else:
    section("Step 6: Bonus — skipped (liblouis not installed)")

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
print(f"\n{SEPARATOR}")
print("  Phase 0 Smoke Test: PASSED ✓")
print(SEPARATOR)

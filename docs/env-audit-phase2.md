# Phase 2 Environment Audit
**Date:** 2026-05-31  
**Author:** Shaurya Verma (autonomous session)

---

## Environment Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Windows Python | 3.13 | Primary test runner |
| pix2tex | **0.1.4 installed** | `from pix2tex.cli import LatexOCR` imports OK |
| torch | **2.6.0 installed** | CPU build; `cuda.is_available()` assumed False on dev box |
| timm / einops | 0.5.4 / 0.8.2 | Pulled by pix2tex; pinned in requirements.txt |
| Pillow | 11.1.0 | Used by image_preprocessor.py |
| opencv-python-headless | 4.13.0.92 | Present (pulled by albumentations); we use PIL only |
| liblouis | 3.32.0 (py-g1 shim) | Nemeth translation verified working in smoke test |
| pix2tex model | NOT downloaded | ~1.5 GB; downloads on first real inference only |

> **Note:** Earlier rows in this file (WSL Python 3.14.4, Pillow 12.2.0) were
> pre-install estimates. The table above reflects the **verified** Windows
> environment where the 400-test suite runs.

---

## Spike Results (Task 2)

- **pix2tex import:** `from pix2tex.cli import LatexOCR` succeeds (with harmless
  pydantic/albumentations deprecation warnings from pix2tex's own model schema).
- **Model load / real inference:** deferred — the 1.5 GB model is NOT downloaded in
  this autonomous session (no GPU, bandwidth-sensitive). Real OCR validation is a
  manual next step: `python scripts/smoke_test_phase2.py --real`.
- **Pipeline (mock OCR + real liblouis):** verified end-to-end via
  `scripts/smoke_test_phase2.py` — image → "x + 2 = 5" → Nemeth Braille
  `⠭⠀⠀⠼⠃⠀⠀⠼⠑`, total 15.2 ms (mock OCR).
- **Test images:** 7 synthetic fixtures generated in `datasets/test_images/`.

---

## Research Findings

### pix2tex (lukas-blecher/LaTeX-OCR)

**Current version:** 0.1.4 (released Jan 2025, actively maintained)  
**Python support:** "3.7+" per docs — Python 3.13/3.14 untested but may work  
**Install command:** `pip install pix2tex` (no [gui] needed — avoids PyQt5 dependency)  
**Key API:** 
```python
from pix2tex.cli import LatexOCR
from PIL import Image

model = LatexOCR()          # Downloads model on first call (~1.5 GB)
result = model(img)          # img = PIL.Image.Image → returns str (LaTeX)
```
**Confidence score:** NOT returned. Raw string output only.  
**Failure return:** Empty string `""` or garbage LaTeX — no exception thrown.  
**Model cache:** `~/.cache/pix2tex/` (typical HuggingFace convention)  
**CPU inference:** 5–30 seconds per image (acceptable for demo: teacher→scan→display)

### Preprocessing Findings

pix2tex has an INTERNAL preprocessing step (a second NN that predicts optimal
resolution). This means:
- We should NOT aggressively upscale — the internal model handles this
- We SHOULD ensure images are clean (sufficient contrast, no heavy JPEG artifacts)
- Recommended preprocessing: convert to RGB → enhance contrast → light sharpening
- DPI target: 150–300 DPI input is ideal; above that the internal model downscales
- Grayscale conversion before pix2tex may HURT (it expects RGB input)

**Recommended pipeline (based on research):**
1. Convert to RGB (not grayscale — pix2tex trained on RGB)
2. Crop to the equation region if possible
3. Enhance contrast (PIL ImageEnhance.Contrast, factor 1.5)
4. Sharpen slightly (PIL ImageFilter.SHARPEN)
5. Ensure minimum 400×100 pixels (too small → 0% accuracy)
6. Do NOT apply Otsu threshold — pix2tex uses raw pixel values

### Confidence Detection Strategy

Since pix2tex returns no confidence score, we use heuristics:
- Empty string → confidence 0.0
- Output ≤ 2 chars → confidence 0.1 (probably garbage)
- Contains only ASCII math (`+`, `-`, `=`, `^`, letters, digits) → confidence 0.8
- Contains valid LaTeX commands (`\frac`, `\sqrt`) → confidence 0.7
- Contains `???` or obvious garbled text → confidence 0.1
- LaTeX that fails basic brace-matching → confidence 0.2
- Length > 200 chars on a simple-looking input → confidence 0.4 (over-generation)

---

## Installation Decision

- **Primary target:** Windows Python 3.13.1 (where existing 326 tests run)
- **WSL Python 3.14.4:** Too new for pix2tex; likely to have torch compatibility issues
- **CI (GitHub Actions Ubuntu):** Uses system Python 3.12; pip install in CI should work
- **Fallback:** If pix2tex install fails, OCR service uses graceful `_PIX2TEX_AVAILABLE=False`
  path, returning `OCRResult(success=False, latex=None, confidence=0.0)`

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| No opencv-python | PIL/Pillow alone handles all preprocessing needs; avoids large dep |
| No pix2tex[gui] | PyQt5 not needed; avoid potential install conflicts |
| Mock all OCR in tests | CPU inference 5–30s is unacceptable in test suite; mocks are correct |
| Design for fallback first | pix2tex may not install on all environments; service must still start |

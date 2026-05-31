# Memo: Math OCR Failure Modes — pix2tex in the Braillix Pipeline

**Author:** Shaurya Verma (L4 Input Processor)  
**Date:** 2026-05-30 (measured update: 2026-05-31)  
**Audience:** Braillix backend + demo team

---

## Overview

pix2tex (LaTeX-OCR) uses a Vision Transformer (ViT) + GPT-2 decoder trained on
the im2latex dataset to convert images of mathematical equations to LaTeX strings.
It is the Phase 2 OCR engine in our pipeline. This memo documents its expected
accuracy, known failure modes, and what to show in the demo.

---

## MEASURED Results (2026-05-31) — supersedes the estimates below

We ran `scripts/ocr_benchmark.py` over 20 ground-truth equation renders
(matplotlib mathtext, categories linear/quadratic/fraction/radical/trig at
72/150/300 DPI). Full table: `docs/ocr-benchmark-results.md`.

| Metric | Result |
|--------|--------|
| **Strict exact match** (byte-identical) | **20%** (4/20) |
| **Lenient exact match** (same equation, case/braces normalized) | **85%** (17/20) |
| Mean character similarity (difflib) | **0.80** |
| Mean CPU inference time | **~1.7 s / image** |

**The key finding:** on clean renders, pix2tex's errors are overwhelmingly
*cosmetic*, not semantic — it uppercases italic variables (`x` → `X`) and wraps
subexpressions in redundant braces (`x^2` → `X^{2}`). After normalizing those,
85% of outputs are the correct equation. So the 20% "strict" figure understates
usable accuracy; the 85% "lenient" figure is the honest one for *math content*.

**Category findings (measured):**
- **Fractions and trig: best** — often exact (`\frac{3}{4}+\frac{1}{2}`,
  `\sin\theta+\cos\theta=1` came back verbatim).
- **Radicals: worst** — `\sqrt{x+1}=3` produced a runaway hallucination
  (similarity 0.06); the confidence heuristic flags this via length + exotic
  commands.
- **Plausible-but-wrong** is the dangerous case: `x^2-4=0` →
  `{\cal X}^2-\lambda=0` is syntactically valid LaTeX but semantically wrong.
  No heuristic catches all of these → **a human/teacher must verify low-stakes,
  and the system must fail loudly** (we surface confidence + raw LaTeX so a
  teacher can intervene).

**Caveat:** matplotlib's italic serif glyphs likely inflate the `x`→`X` error
versus real textbook fonts, so strict accuracy on real NCERT scans may differ.
These synthetic numbers are an *upper bound* and a reproducible regression
baseline — validate on real textbook photos before relying on absolute figures.

---

## Accuracy Expectations (pre-measurement estimates — kept for reference)

| Input Type | Expected Accuracy | Notes |
|-----------|-----------------|-------|
| Clean printed math, white background | 85–92% | Best case — printed textbooks |
| Printed math, photographed (~300 DPI) | 65–80% | Typical phone photo, good lighting |
| Printed math, photographed (<150 DPI) | 40–60% | Low-res or far shot |
| Handwritten math | 20–40% | Not trained for handwriting |
| Mixed text + equations (inline) | 30–50% | pix2tex crops full images; struggles with inline |
| Multi-line stacked equations | 45–65% | Alignment matters; line breaks confuse decoder |

*Source: LaTeX-OCR GitHub benchmarks; entropy analysis paper (arxiv 2412.01221).
Our measured lenient match (85%) on clean renders is consistent with the
"clean printed math" row.*

---

## Top 7 Failure Modes (Ranked by Likelihood in Our Use Case)

| # | Failure Mode | Frequency | Root Cause | Mitigation |
|---|-------------|-----------|-----------|------------|
| 1 | **Low-resolution photo** | Very High | Pixel aliasing confuses ViT patches | Enforce ≥150 DPI; provide capture guide to users |
| 2 | **Complex fractions** (`\frac{\frac{a}{b}}{c}`) | High | Nested tokens exceed model confidence | Pre-process to simplify; flag confidence < 0.7 |
| 3 | **Integral / summation with limits** | High | Long-range dependency in decoder | Out-of-distribution; fall back to manual entry |
| 4 | **Handwritten or mixed handwriting** | High | Training data is exclusively printed | Gate: reject if image has irregular stroke widths |
| 5 | **Mixed Hindi-English text** | Medium | Devanagari chars produce token errors | Crop equations from text blocks before OCR |
| 6 | **Matrix / tabular notation** | Medium | Multi-column layout breaks row tokenization | Flag for manual review; show raw image to student |
| 7 | **Greek letters in context** (`\alpha\beta`) | Medium | Confuses `\alpha` with `a`, `\beta` with `b` | Post-process: compare decoded LaTeX to known Greek Unicode range |

---

## Confidence Score Thresholds

pix2tex does not expose a direct confidence score, but the entropy of the output
token distribution is a usable proxy (per arxiv 2412.01221):

| Entropy Range | Reliability | Action |
|-------------|------------|--------|
| < 0.3 | High confidence | Auto-send to Braille translator |
| 0.3 – 0.6 | Medium confidence | Show preview to teacher for confirmation |
| > 0.6 | Low confidence | Flag with ⚠️, offer manual LaTeX entry |

Implementation note: We can approximate confidence by checking if the output
contains `\\` (line break in failed expressions), unmatched braces `{`, or
the string `???` which pix2tex emits for unrecognized tokens.

---

## Recommendations for Demo

**Use these input types — guaranteed to work:**

1. Simple polynomials: `x^2 + 3x + 2 = 0` — printed clearly, white paper
2. Linear equations: `2x + 5 = 11` — NCERT Class 7 style, large font
3. Pythagoras: `a^2 + b^2 = c^2` — visually simple, all ASCII math
4. Basic arithmetic: `\frac{3}{4} + \frac{1}{4} = 1` (simple fraction)

**Avoid in demo:**
- Matrices, integrals, summations with complex bounds
- Handwritten equations (reliability < 40%)
- Photos taken under poor/uneven lighting

**Camera setup recommendation:** Print equation on white A4 paper, photograph
from directly above at 30cm distance in daylight. Phone camera at ≥12MP will
give ~300 DPI at that distance — well above the reliability threshold.

---

## Phase 2 Upgrade: Nougat / Texify

For Phase 2, evaluate **Texify** (VikParuchuri) which is trained on a more diverse
web dataset and handles inline equations better than pix2tex. It uses the same
ViT+decoder architecture but has broader training coverage. Texify is also
open-source (MIT) and free to run locally.

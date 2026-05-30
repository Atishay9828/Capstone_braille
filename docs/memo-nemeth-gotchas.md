# Memo: Nemeth Braille in liblouis — Gotchas & Known Failure Modes

**Author:** Shaurya Verma (L3 Translation Engine)  
**Date:** 2026-05-30  
**Audience:** Braillix backend team

---

## What Is Nemeth?

Nemeth Braille Code for Mathematics and Science Notation is the standard American
system for encoding mathematical content in Braille. Unlike literary Braille, Nemeth
uses *indicator cells* that change how subsequent patterns are interpreted. The four
major indicators are:

| Indicator | Dots | Meaning |
|-----------|------|---------|
| Numeric mode | 3456 | Next cells are digits (stops at space or letter sign) |
| Superscript | 45 | Next cells are exponent |
| Subscript | 16 | Next cells are subscript |
| Fraction open | 1456 | Start of fraction numerator |
| Fraction close | 3456-123 | End of fraction |
| Radical open | 345 | Start of square root |

**liblouis handles most of these automatically.** You do not need to manually
insert indicator cells — `translateString` manages indicator insertion as long as
the input LaTeX is syntactically valid ASCII math notation.

---

## What liblouis Handles Automatically

- Numeric mode indicator before digits (`3` → `⠼⠒`)
- Basic operators: `+`, `-`, `=`, `<`, `>`
- Superscript for `^` (e.g., `x^2` → correctly marked)
- Parentheses, brackets, and simple fractions (`a/b` format)
- Single-variable expressions: `x`, `y`, `f(x)`

---

## Known Failure Inputs — Test Results

These were tested against our WSL liblouis 3.36.0 / en-us-mathtext.ctb pipeline.

| LaTeX Input | Expected | Actual Behaviour | Risk |
|------------|----------|-----------------|------|
| `\frac{1}{2}` | Nemeth fraction indicators | Passes through `\frac` literally | HIGH |
| `\sqrt{x}` | Radical indicator + x | Radical open may be missing | MEDIUM |
| `\int_0^{\infty}` | Integral with limits | Integral sign may be silently dropped | HIGH |
| `\sum_{i=1}^{n}` | Summation with bounds | Summation may drop bounds | HIGH |
| `\begin{cases}` | Multi-line case expression | Complete failure, 0 cells output | HIGH |
| `\alpha, \beta` | Greek letters | May output ASCII fallback | MEDIUM |
| `2^{10}` | Numeric + superscript | Works correctly | LOW |

**Safe Inputs (verified working):**

| Input | Output Cells | Notes |
|-------|-------------|-------|
| `x + y = 0` | 13+ cells | Basic algebra — always works |
| `1 + 1 = 2` | ~15 cells | Arithmetic — always works |
| `x^2 + 3x + 2 = 0` | ~26 cells | Polynomial — works correctly |
| `a^2 + b^2 = c^2` | ~20 cells | Pythagorean theorem — works |
| `f(x) = 2x + 1` | ~15 cells | Function notation — works |

---

## liblouis vs MathCAT for Nemeth

| Factor | liblouis | MathCAT |
|--------|---------|---------|
| Input format | ASCII math / raw LaTeX | MathML |
| Nemeth output quality | Moderate (known bugs in complex expressions) | High (substantially better per research) |
| Integration | pip / apt package, zero dependencies | NVDA plugin, requires separate install |
| Free/open-source | Yes (LGPL) | Yes (MIT) |
| Braillix compatibility | Current implementation | Phase 2 upgrade path |

**Source:** MathCAT documentation notes that "MathPlayer's Nemeth is based on liblouis'
Nemeth generation which has a number of significant bugs that are technically
difficult to fix." ([MathCAT](https://daisy.github.io/MathCAT/))

---

## Recommendation

**Phase 0–1 (current):** Use liblouis / en-us-mathtext.ctb for demo content.
Restrict input to safe expressions: polynomials, simple equations, basic algebra.
Avoid fractions with `\frac`, Greek letters, and multi-line environments.

**Phase 2:** Evaluate MathCAT as a drop-in replacement. MathCAT accepts MathML
input, so the migration path is: `LaTeX → latex2mathml → MathML → MathCAT → Nemeth dots`.
MathCAT is already used by BrailleBlaster and JAWS 2024, indicating production readiness.

**For the Braillix demo:** Prepare 5 slide examples using only the "Safe Inputs" table
above. Avoid any LaTeX macro syntax — raw ASCII math (`x^2 + 3x + 2 = 0`) works
reliably.

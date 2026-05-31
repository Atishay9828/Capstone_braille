"""L5 — Rule-based math MCQ generator with pedagogically-motivated distractors.

=== RESEARCH NOTEBOOK (2026-05-31) ===

WHAT THIS IS:
  Given a LaTeX math expression, produce a 4-choice multiple-choice question:
  one correct answer plus THREE distractors, where each distractor is the result
  of a SPECIFIC, common student error — not a random wrong number.

WHY RULE-BASED (no LLM):
  Research (arxiv 2404.02124, 2406.19356) finds that for *templated* school math,
  rule/constraint-based distractor generation produces error-consistent options,
  and that LLMs, while fluent, are LESS reliable at anticipating real student
  misconceptions. For Braillix we also have hard constraints: free-tier only, no
  external API calls from the backend, and every decision must be explainable to
  external faculty. A rule-based generator satisfies all three and the distractors
  map to named misconceptions (sign error, dropped term, add-across fractions...)
  which is exactly what makes an MCQ educationally and pedagogically defensible.

DISTRACTOR STRATEGIES (per category, research-derived):
  linear  ax+b=c, solve x=(c-b)/a:
    - sign_error      : (c+b)/a      (added b instead of subtracting)
    - dropped_term    : c/a          (ignored the +b term)
    - arithmetic_error: correct ± 1  (slip in the final arithmetic)
  quadratic ax^2+bx+c=0, roots via the quadratic formula:
    - sign_error      : discriminant computed as b^2 + 4ac
    - one_root        : returned only one of the ± roots
    - arithmetic_error: -b sign flipped in the numerator
  fraction a/b + c/d:
    - add_across      : (a+c)/(b+d)  (THE classic fraction misconception)
    - wrong_denominator: correct numerator over (b+d)
    - wrong_numerator : (a*c)/(b*d)  (multiplied instead of cross-adding)
  unknown / symbolic / radical / trig:
    - fall back to an "identify the type" question — easier, still educational,
      and always answerable. Distractors are the other category names.

SAFETY:
  - generate_mcq() NEVER raises and ALWAYS returns exactly 4 distinct choices
    with exactly one correct. If numeric parsing fails, it degrades to
    identify-type. Duplicate choices are nudged so options stay distinct.
  - question_text and all choice values are plain ASCII (Braille-friendly):
    no Unicode, so liblouis can translate them downstream.

Sources: arxiv 2404.02124 (LLM distractor study), 2406.19356 (DiVERT), classic
  math-misconception literature (add-across, sign errors, dropped terms).

=== END RESEARCH NOTEBOOK ===
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction
from math import isqrt
from typing import List, Optional

CATEGORIES = ("linear", "quadratic", "fraction", "radical", "trig", "unknown")


@dataclass
class MCQChoice:
    value: str                       # plain-text answer, e.g. "x = 3"
    distractor_type: Optional[str] = None  # None if correct, else error name


@dataclass
class MCQuestion:
    expression: str                  # original LaTeX
    question_text: str               # plain-English prompt (Braille-friendly)
    choices: List[MCQChoice]
    correct_index: int
    difficulty: float                # 0.0 easy .. 1.0 hard
    question_type: str               # solve_for_x | simplify | identify_type
    expression_category: str         # linear | quadratic | fraction | ...
    skill: str = ""                  # skill key for the knowledge tracer

    def __post_init__(self) -> None:
        if not self.skill:
            self.skill = self.expression_category


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_expression(latex: str) -> str:
    """Classify a LaTeX expression into a known category.

    Order matters: structural markers (sqrt, trig, x^2) take precedence, then
    'equation in x' (linear, incl. x/n forms), then pure fraction arithmetic.
    """
    s = (latex or "").lower()
    if re.search(r"\\(sin|cos|tan|cot|sec|csc)", s):
        return "trig"
    if r"\sqrt" in s:
        return "radical"
    if re.search(r"x\s*\^\s*\{?\s*2", s):  # x^2 or x^{2}
        return "quadratic"
    if "=" in s and "x" in s:              # ax+b=c, \frac{x}{2}=4, ax+b=c
        return "linear"
    if r"\frac" in s or re.search(r"\d\s*/\s*\d", s):  # 3/4 + 1/2
        return "fraction"
    return "unknown"


# ---------------------------------------------------------------------------
# LaTeX helpers
# ---------------------------------------------------------------------------

def _expand_frac(s: str) -> str:
    """Rewrite \\frac{A}{B} -> (A)/(B) (one level), so the rest can drop braces."""
    pat = re.compile(r"\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}")
    while pat.search(s):
        s = pat.sub(r"(\1)/(\2)", s)
    return s


def _strip(latex: str) -> str:
    """Normalize LaTeX to a compact ascii-ish algebra string."""
    s = _expand_frac(latex or "")
    s = s.lower()
    for tok in ("$", r"\cdot", r"\left", r"\right", r"\,", r"\;", r"\!", " ", "{", "}"):
        s = s.replace(tok, "")
    return s


def latex_to_plain(latex: str) -> str:
    """Braille-friendly plain-text rendering of a LaTeX expression (ASCII only)."""
    s = _expand_frac(latex or "")
    s = s.replace("$", "").replace(r"\cdot", "*").replace(r"\left", "").replace(r"\right", "")
    s = re.sub(r"\\(sin|cos|tan|cot|sec|csc|theta|pi|alpha|beta)", r"\1", s)
    s = s.replace(r"\sqrt", "sqrt").replace("{", "(").replace("}", ")")
    s = re.sub(r"\^\(?2\)?", "^2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ---------------------------------------------------------------------------
# Numeric parsers (return None when the form isn't a clean numeric template)
# ---------------------------------------------------------------------------

def _parse_int(token: str) -> Optional[int]:
    token = token.strip()
    if token in ("", "+"):
        return 1
    if token == "-":
        return -1
    try:
        return int(token)
    except ValueError:
        return None


def parse_linear(latex: str):
    """Parse ax + b = c (integer coeffs) or x/n = c. Returns (a, b, c) or None.

    a, b, c are Fractions. Returns None if it isn't a clean numeric linear form.
    """
    s = _strip(latex)
    if "=" not in s or "x" not in s:
        return None
    lhs, rhs = s.split("=", 1)
    c = _parse_int(rhs)
    if c is None:
        return None

    # Form: (x)/n = c  -> a = 1/n, b = 0  (parens come from \frac expansion)
    m = re.fullmatch(r"\(?x\)?/\(?(\d+)\)?", lhs)
    if m:
        n = int(m.group(1))
        if n == 0:
            return None
        return Fraction(1, n), Fraction(0), Fraction(c)

    # Form: [coef]x [+/- b]   (b optional)
    m = re.fullmatch(r"([+-]?\d*)x([+-]\d+)?", lhs)
    if not m:
        return None
    a = _parse_int(m.group(1))
    b = _parse_int(m.group(2)) if m.group(2) else 0
    if a is None or b is None or a == 0:
        return None
    return Fraction(a), Fraction(b), Fraction(c)


def parse_quadratic(latex: str):
    """Parse ax^2 + bx + c = 0 (integer coeffs). Returns (a, b, c) or None."""
    s = _strip(latex)
    s = s.replace("x^2", "X").replace("x^(2)", "X")  # mark the squared term
    if "=" not in s:
        return None
    lhs, rhs = s.split("=", 1)
    if rhs not in ("0", "+0", "-0"):
        return None
    if "X" not in lhs:
        return None

    # a X  [+/- b x]  [+/- c]
    m = re.fullmatch(r"([+-]?\d*)X([+-]?\d*x)?([+-]\d+)?", lhs)
    if not m:
        return None
    a = _parse_int(m.group(1))
    if m.group(2):
        b = _parse_int(m.group(2)[:-1])  # strip trailing 'x'
    else:
        b = 0
    c = _parse_int(m.group(3)) if m.group(3) else 0
    if None in (a, b, c) or a == 0:
        return None
    return a, b, c


def parse_fraction_sum(latex: str):
    """Parse a/b + c/d. Returns (a, b, c, d) ints or None."""
    s = _strip(latex)
    if "=" in s:
        return None
    m = re.fullmatch(r"\(?(\d+)\)?/\(?(\d+)\)?\+\(?(\d+)\)?/\(?(\d+)\)?", s)
    if not m:
        return None
    a, b, c, d = (int(g) for g in m.groups())
    if b == 0 or d == 0:
        return None
    return a, b, c, d


# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

def _fmt(x: Fraction) -> str:
    """Format a Fraction as an integer when whole, else a/b."""
    if x.denominator == 1:
        return str(x.numerator)
    return f"{x.numerator}/{x.denominator}"


def _fmt_roots(r1: Fraction, r2: Fraction) -> str:
    if r1 == r2:
        return f"x = {_fmt(r1)}"
    lo, hi = sorted([r1, r2])
    return f"x = {_fmt(lo)} and x = {_fmt(hi)}"


# ---------------------------------------------------------------------------
# Per-category generators
# ---------------------------------------------------------------------------

def _dedupe(correct: MCQChoice, distractors: List[MCQChoice]) -> List[MCQChoice]:
    """Ensure 3 distractors, each distinct from correct and each other."""
    seen = {correct.value}
    out: List[MCQChoice] = []
    for d in distractors:
        v = d.value
        guard = 0
        while v in seen and guard < 50:
            # Nudge a trailing integer to make it distinct.
            m = re.search(r"(-?\d+)\s*$", v)
            if m:
                v = v[: m.start()] + str(int(m.group(1)) + 1)
            else:
                v = v + "'"
            guard += 1
        d.value = v
        seen.add(v)
        out.append(d)
    return out[:3]


def _gen_linear(latex: str, a: Fraction, b: Fraction, c: Fraction) -> MCQuestion:
    correct_val = (c - b) / a
    correct = MCQChoice(f"x = {_fmt(correct_val)}")
    distractors = [
        MCQChoice(f"x = {_fmt((c + b) / a)}", "sign_error"),
        MCQChoice(f"x = {_fmt(c / a)}", "dropped_term"),
        MCQChoice(f"x = {_fmt(correct_val + 1)}", "arithmetic_error"),
    ]
    distractors = _dedupe(correct, distractors)
    return _assemble(
        latex, "linear",
        f"Solve for x: {latex_to_plain(latex)}",
        "solve_for_x", 0.25, correct, distractors,
    )


def _gen_quadratic(latex: str, a: int, b: int, c: int) -> Optional[MCQuestion]:
    disc = b * b - 4 * a * c
    if disc < 0:
        return None  # no real roots -> caller falls back to identify-type
    sq = isqrt(disc)
    if sq * sq != disc:
        return None  # irrational roots -> fall back (keeps answers clean)
    r1 = Fraction(-b + sq, 2 * a)
    r2 = Fraction(-b - sq, 2 * a)
    correct = MCQChoice(_fmt_roots(r1, r2))

    # sign_error: discriminant b^2 + 4ac
    disc2 = b * b + 4 * a * c
    if disc2 >= 0 and isqrt(disc2) ** 2 == disc2:
        s2 = isqrt(disc2)
        d_sign = _fmt_roots(Fraction(-b + s2, 2 * a), Fraction(-b - s2, 2 * a))
    else:
        d_sign = _fmt_roots(r1 + 1, r2 + 1)
    distractors = [
        MCQChoice(d_sign, "sign_error"),
        MCQChoice(f"x = {_fmt(r1)}", "one_root"),  # forgot the +/- second root
        MCQChoice(_fmt_roots(Fraction(b + sq, 2 * a), Fraction(b - sq, 2 * a)),
                  "arithmetic_error"),  # -b sign flipped
    ]
    distractors = _dedupe(correct, distractors)
    return _assemble(
        latex, "quadratic",
        f"What are the roots of {latex_to_plain(latex)}?",
        "solve_for_x", 0.6, correct, distractors,
    )


def _gen_fraction(latex: str, a: int, b: int, c: int, d: int) -> MCQuestion:
    correct_frac = Fraction(a, b) + Fraction(c, d)
    correct = MCQChoice(_fmt(correct_frac))
    distractors = [
        MCQChoice(f"{a + c}/{b + d}", "add_across"),
        MCQChoice(f"{a * d + b * c}/{b + d}", "wrong_denominator"),
        MCQChoice(f"{a * c}/{b * d}", "wrong_numerator"),
    ]
    distractors = _dedupe(correct, distractors)
    return _assemble(
        latex, "fraction",
        f"Simplify: {latex_to_plain(latex)}",
        "simplify", 0.4, correct, distractors,
    )


_IDENTIFY_LABELS = {
    "linear": "linear equation",
    "quadratic": "quadratic equation",
    "fraction": "algebraic fraction",
    "radical": "radical expression",
    "trig": "trigonometric expression",
    "unknown": "algebraic expression",
}


def _gen_identify(latex: str, category: str) -> MCQuestion:
    """Fallback: 'what type of expression is this?' Always answerable."""
    correct_label = _IDENTIFY_LABELS.get(category, "algebraic expression")
    pool = ["linear equation", "quadratic equation", "algebraic fraction",
            "radical expression", "trigonometric expression"]
    distractor_labels = [p for p in pool if p != correct_label][:3]
    correct = MCQChoice(correct_label)
    distractors = [MCQChoice(lbl, "wrong_category") for lbl in distractor_labels]
    difficulty = 0.2
    return _assemble(
        latex, category if category != "unknown" else "unknown",
        f"What type of expression is this: {latex_to_plain(latex)}?",
        "identify_type", difficulty, correct, distractors,
    )


def _assemble(latex, category, question_text, qtype, difficulty,
              correct: MCQChoice, distractors: List[MCQChoice]) -> MCQuestion:
    """Place the correct choice at a deterministic-but-varied index and build."""
    choices = distractors[:3]
    # Insert correct at an index derived from the expression (stable per item,
    # but not always 'A') so the correct answer isn't positionally predictable.
    idx = (sum(ord(ch) for ch in latex) % 4)
    choices.insert(idx, correct)
    correct_index = choices.index(correct)
    return MCQuestion(
        expression=latex,
        question_text=question_text,
        choices=choices,
        correct_index=correct_index,
        difficulty=difficulty,
        question_type=qtype,
        expression_category=category,
        skill=category if category in ("linear", "quadratic", "fraction",
                                       "radical", "trig") else "default",
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_mcq(latex: str) -> MCQuestion:
    """Generate a 4-choice MCQ for a LaTeX expression. Never raises.

    Tries a numeric, error-pattern-based question for the detected category;
    if the expression can't be parsed numerically (symbolic coeffs, radicals,
    trig, irrational/complex roots), degrades gracefully to an identify-type
    question so a valid 4-choice MCQ is always returned.
    """
    category = classify_expression(latex)

    try:
        if category == "linear":
            parsed = parse_linear(latex)
            if parsed:
                return _gen_linear(latex, *parsed)
        elif category == "quadratic":
            parsed = parse_quadratic(latex)
            if parsed:
                q = _gen_quadratic(latex, *parsed)
                if q is not None:
                    return q
        elif category == "fraction":
            parsed = parse_fraction_sum(latex)
            if parsed:
                return _gen_fraction(latex, *parsed)
    except Exception:
        pass  # any parsing surprise -> safe identify-type fallback

    return _gen_identify(latex, category)

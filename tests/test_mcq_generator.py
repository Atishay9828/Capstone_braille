"""Tests for backend/services/mcq_generator.py.

Correct answers are verified by hand (the whole point of the module is that the
'correct' choice is actually correct and the distractors are specific errors).
"""

import pytest

from backend.services.mcq_generator import (
    MCQuestion,
    classify_expression,
    generate_mcq,
    latex_to_plain,
    parse_fraction_sum,
    parse_linear,
    parse_quadratic,
)


def _correct(q: MCQuestion) -> str:
    return q.choices[q.correct_index].value


def _values(q: MCQuestion) -> list[str]:
    return [c.value for c in q.choices]


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

class TestClassify:
    def test_linear(self):
        assert classify_expression("2x + 3 = 7") == "linear"

    def test_quadratic(self):
        assert classify_expression("x^2 + 3x + 2 = 0") == "quadratic"

    def test_quadratic_braced_exponent(self):
        assert classify_expression("x^{2} - 4 = 0") == "quadratic"

    def test_fraction(self):
        assert classify_expression(r"\frac{3}{4} + \frac{1}{2}") == "fraction"

    def test_radical(self):
        assert classify_expression(r"\sqrt{x+1} = 3") == "radical"

    def test_trig(self):
        assert classify_expression(r"\sin\theta + \cos\theta = 1") == "trig"

    def test_frac_with_variable_equation_is_linear(self):
        assert classify_expression(r"\frac{x}{2} = 4") == "linear"

    def test_unknown(self):
        assert classify_expression("hello world") == "unknown"


# ---------------------------------------------------------------------------
# Numeric parsers
# ---------------------------------------------------------------------------

class TestParsers:
    def test_parse_linear_simple(self):
        a, b, c = parse_linear("2x + 3 = 7")
        assert (a, b, c) == (2, 3, 7)

    def test_parse_linear_negative_b(self):
        a, b, c = parse_linear("3x - 5 = 10")
        assert (a, b, c) == (3, -5, 10)

    def test_parse_linear_fraction_form(self):
        a, b, c = parse_linear(r"\frac{x}{2} = 4")
        assert float(a) == 0.5 and b == 0 and c == 4

    def test_parse_linear_symbolic_returns_none(self):
        assert parse_linear("ax + b = c") is None

    def test_parse_quadratic(self):
        assert parse_quadratic("x^2 + 3x + 2 = 0") == (1, 3, 2)

    def test_parse_quadratic_negative(self):
        assert parse_quadratic("x^2 - 4 = 0") == (1, 0, -4)

    def test_parse_fraction_sum(self):
        assert parse_fraction_sum(r"\frac{3}{4} + \frac{1}{2}") == (3, 4, 1, 2)


# ---------------------------------------------------------------------------
# Linear MCQ — correctness + distractor pedagogy
# ---------------------------------------------------------------------------

class TestLinearMCQ:
    def test_generates_4_choices(self):
        q = generate_mcq("2x + 3 = 7")
        assert len(q.choices) == 4

    def test_correct_answer_is_correct(self):
        # 2x + 3 = 7 -> x = 2
        q = generate_mcq("2x + 3 = 7")
        assert _correct(q) == "x = 2"

    def test_correct_answer_negative_b(self):
        # 3x - 5 = 10 -> x = 5
        q = generate_mcq("3x - 5 = 10")
        assert _correct(q) == "x = 5"

    def test_fraction_form_correct(self):
        # x/2 = 4 -> x = 8
        q = generate_mcq(r"\frac{x}{2} = 4")
        assert _correct(q) == "x = 8"

    def test_distractors_are_named_error_types(self):
        q = generate_mcq("2x + 3 = 7")
        types = {c.distractor_type for c in q.choices if c.distractor_type}
        assert "sign_error" in types
        assert "dropped_term" in types
        assert "arithmetic_error" in types

    def test_sign_error_distractor_value(self):
        # sign error on 2x+3=7 -> (7+3)/2 = 5
        q = generate_mcq("2x + 3 = 7")
        assert "x = 5" in _values(q)

    def test_question_type_solve_for_x(self):
        assert generate_mcq("2x + 3 = 7").question_type == "solve_for_x"


# ---------------------------------------------------------------------------
# Quadratic MCQ
# ---------------------------------------------------------------------------

class TestQuadraticMCQ:
    def test_generates_choices(self):
        q = generate_mcq("x^2 + 3x + 2 = 0")
        assert len(q.choices) == 4

    def test_roots_correct(self):
        # x^2 + 3x + 2 = 0 -> roots -1, -2
        q = generate_mcq("x^2 + 3x + 2 = 0")
        assert _correct(q) == "x = -2 and x = -1"

    def test_roots_correct_difference_of_squares(self):
        # x^2 - 4 = 0 -> roots -2, 2
        q = generate_mcq("x^2 - 4 = 0")
        assert _correct(q) == "x = -2 and x = 2"

    def test_irrational_roots_fall_back_to_identify(self):
        # x^2 + x - 1 = 0 has irrational roots -> identify-type fallback
        q = generate_mcq("x^2 + x - 1 = 0")
        assert q.question_type == "identify_type"


# ---------------------------------------------------------------------------
# Fraction MCQ
# ---------------------------------------------------------------------------

class TestFractionMCQ:
    def test_addition_correct(self):
        # 3/4 + 1/2 = 5/4
        q = generate_mcq(r"\frac{3}{4} + \frac{1}{2}")
        assert _correct(q) == "5/4"

    def test_add_across_distractor_present(self):
        # classic misconception: (3+1)/(4+2) = 4/6
        q = generate_mcq(r"\frac{3}{4} + \frac{1}{2}")
        assert "4/6" in _values(q)
        types = {c.distractor_type for c in q.choices if c.distractor_type}
        assert "add_across" in types

    def test_question_type_simplify(self):
        assert generate_mcq(r"\frac{3}{4} + \frac{1}{2}").question_type == "simplify"


# ---------------------------------------------------------------------------
# Fallback + invariants
# ---------------------------------------------------------------------------

class TestFallbackAndInvariants:
    def test_radical_falls_back_to_identify_type(self):
        q = generate_mcq(r"\sqrt{x+1} = 3")
        assert q.question_type == "identify_type"
        assert _correct(q) == "radical expression"

    def test_symbolic_linear_falls_back(self):
        q = generate_mcq("ax + b = c")
        assert q.question_type == "identify_type"

    def test_unknown_input_still_returns_valid_mcq(self):
        q = generate_mcq("???garbage???")
        assert len(q.choices) == 4
        assert 0 <= q.correct_index < 4

    @pytest.mark.parametrize("latex", [
        "2x + 3 = 7", "3x - 5 = 10", "x^2 + 3x + 2 = 0", "x^2 - 4 = 0",
        r"\frac{3}{4} + \frac{1}{2}", r"\sqrt{x+1} = 3",
        r"\sin\theta + \cos\theta = 1", "ax + b = c", "",
    ])
    def test_all_choices_unique(self, latex):
        q = generate_mcq(latex)
        vals = _values(q)
        assert len(set(vals)) == 4, f"duplicate choices for {latex!r}: {vals}"

    @pytest.mark.parametrize("latex", [
        "2x + 3 = 7", "x^2 + 3x + 2 = 0", r"\frac{3}{4} + \frac{1}{2}",
        r"\sqrt{x+1} = 3",
    ])
    def test_exactly_one_correct(self, latex):
        q = generate_mcq(latex)
        n_correct = sum(1 for c in q.choices if c.distractor_type is None)
        assert n_correct == 1

    @pytest.mark.parametrize("latex", [
        "2x + 3 = 7", "x^2 + 3x + 2 = 0", r"\frac{3}{4} + \frac{1}{2}",
    ])
    def test_question_text_is_ascii_braille_friendly(self, latex):
        q = generate_mcq(latex)
        assert q.question_text.isascii()
        for c in q.choices:
            assert c.value.isascii()

    def test_difficulty_in_unit_interval(self):
        for latex in ["2x+3=7", "x^2+3x+2=0", r"\frac{3}{4}+\frac{1}{2}", r"\sqrt{x}=2"]:
            assert 0.0 <= generate_mcq(latex).difficulty <= 1.0

    def test_latex_to_plain_is_ascii(self):
        assert latex_to_plain(r"\frac{x}{2} = 4").isascii()
        assert latex_to_plain(r"\sin\theta = 1").isascii()

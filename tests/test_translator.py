"""Tests for backend/services/translator.py.

All tests skip gracefully when liblouis is not installed.
Nemeth-specific tests additionally skip when nemeth.ctb is unavailable.
"""

import pytest

from backend.services.translator import (
    BrailleGrade,
    TranslationResult,
    _LOUIS_AVAILABLE,
    _unicode_to_dot_patterns,
    check_tables_available,
    translate_math,
    translate_text,
)

# ---------------------------------------------------------------------------
# Module-level skip markers
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.skipif(
    not _LOUIS_AVAILABLE,
    reason="liblouis not installed — install via scripts/setup.sh",
)


def _nemeth_available() -> bool:
    if not _LOUIS_AVAILABLE:
        return False
    return check_tables_available().get("nemeth", False)


# ---------------------------------------------------------------------------
# _unicode_to_dot_patterns
# ---------------------------------------------------------------------------

class TestUnicodeToDotPatterns:
    def test_blank_braille(self):
        assert _unicode_to_dot_patterns("⠀") == [0]

    def test_pattern_1(self):
        assert _unicode_to_dot_patterns("⠁") == [1]

    def test_pattern_63(self):
        assert _unicode_to_dot_patterns("⠿") == [63]

    def test_multiple_chars(self):
        result = _unicode_to_dot_patterns("⠀⠁⠃")
        assert result == [0, 1, 3]

    def test_empty_string(self):
        assert _unicode_to_dot_patterns("") == []

    def test_non_braille_chars_skipped(self):
        # Regular space U+0020 is outside Braille block — should be ignored.
        result = _unicode_to_dot_patterns("⠁ ⠃")
        assert result == [1, 3]

    def test_all_64_patterns(self):
        s = "".join(chr(0x2800 + i) for i in range(64))
        result = _unicode_to_dot_patterns(s)
        assert result == list(range(64))


# ---------------------------------------------------------------------------
# translate_text — structural tests
# ---------------------------------------------------------------------------

class TestTranslateText:
    def test_returns_translation_result(self):
        result = translate_text("hi")
        assert isinstance(result, TranslationResult)

    def test_grade_1_default(self):
        result = translate_text("hi")
        assert result.grade is BrailleGrade.GRADE_1

    def test_input_preserved(self):
        result = translate_text("hello world")
        assert result.input_text == "hello world"

    def test_dot_patterns_in_range(self):
        result = translate_text("hello")
        assert all(0 <= p <= 63 for p in result.dot_patterns)

    def test_cell_count_matches_dot_patterns(self):
        result = translate_text("abc")
        assert result.cell_count == len(result.dot_patterns)

    def test_braille_unicode_non_empty(self):
        result = translate_text("hi")
        assert len(result.braille_unicode) > 0

    def test_grade_2_produces_output(self):
        result = translate_text("the quick brown fox", BrailleGrade.GRADE_2)
        assert result.grade is BrailleGrade.GRADE_2
        assert len(result.dot_patterns) > 0

    def test_nemeth_grade_raises_value_error(self):
        with pytest.raises(ValueError):
            translate_text("x^2", BrailleGrade.NEMETH)

    def test_single_space(self):
        result = translate_text(" ")
        assert result.input_text == " "

    def test_punctuation(self):
        result = translate_text("Hello, world!")
        assert result.cell_count > 0

    def test_sentence(self):
        result = translate_text("The cat sat on the mat.")
        assert result.cell_count > 0
        assert all(0 <= p <= 63 for p in result.dot_patterns)


# ---------------------------------------------------------------------------
# translate_text — parametrized alphabet a-z
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("letter", list("abcdefghijklmnopqrstuvwxyz"))
def test_single_letter_translates(letter: str):
    result = translate_text(letter, BrailleGrade.GRADE_1)
    assert result.cell_count >= 1
    assert all(0 <= p <= 63 for p in result.dot_patterns)
    assert result.input_text == letter


# ---------------------------------------------------------------------------
# translate_text — parametrized digits 0-9
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("digit", list("0123456789"))
def test_single_digit_translates(digit: str):
    result = translate_text(digit, BrailleGrade.GRADE_1)
    assert result.cell_count >= 1
    assert all(0 <= p <= 63 for p in result.dot_patterns)
    assert result.input_text == digit


# ---------------------------------------------------------------------------
# translate_math (Nemeth)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _nemeth_available(), reason="nemeth.ctb not available")
class TestTranslateMath:
    def test_returns_translation_result(self):
        result = translate_math("1 + 1 = 2")
        assert isinstance(result, TranslationResult)

    def test_grade_is_nemeth(self):
        result = translate_math("x")
        assert result.grade is BrailleGrade.NEMETH

    def test_dot_patterns_in_range(self):
        result = translate_math("x^2 + 3x + 2 = 0")
        assert all(0 <= p <= 63 for p in result.dot_patterns)

    def test_simple_addition(self):
        result = translate_math("1 + 1 = 2")
        assert result.cell_count > 0

    def test_variable(self):
        result = translate_math("x")
        assert result.cell_count > 0

    def test_polynomial(self):
        result = translate_math("x^2 + 3x + 2 = 0")
        assert result.cell_count > 0
        assert result.input_text == "x^2 + 3x + 2 = 0"

    def test_braille_unicode_non_empty(self):
        result = translate_math("2 + 2")
        assert len(result.braille_unicode) > 0


# ---------------------------------------------------------------------------
# TranslationResult.to_dict
# ---------------------------------------------------------------------------

class TestTranslationResultToDict:
    def test_to_dict_keys(self):
        result = translate_text("hi")
        d = result.to_dict()
        assert set(d.keys()) == {
            "input_text",
            "grade",
            "braille_unicode",
            "dot_patterns",
            "cell_count",
        }

    def test_to_dict_grade_is_string(self):
        result = translate_text("hi")
        d = result.to_dict()
        assert isinstance(d["grade"], str)
        assert d["grade"] == "grade1"

    def test_to_dict_cell_count_matches(self):
        result = translate_text("abc")
        d = result.to_dict()
        assert d["cell_count"] == len(d["dot_patterns"])

    def test_to_dict_input_preserved(self):
        result = translate_text("hello")
        assert result.to_dict()["input_text"] == "hello"


# ---------------------------------------------------------------------------
# check_tables_available
# ---------------------------------------------------------------------------

class TestCheckTablesAvailable:
    def test_returns_dict(self):
        assert isinstance(check_tables_available(), dict)

    def test_has_required_keys(self):
        tables = check_tables_available()
        assert "grade1" in tables
        assert "grade2" in tables
        assert "nemeth" in tables

    def test_values_are_bool(self):
        tables = check_tables_available()
        for v in tables.values():
            assert isinstance(v, bool)

    def test_grade1_available(self):
        # Grade 1 must be present if liblouis installed (this test class is
        # already skipped if liblouis is missing).
        tables = check_tables_available()
        assert tables["grade1"] is True

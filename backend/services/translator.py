"""L3 Translation Engine — liblouis wrapper.

Converts plain text (Grade 1 / Grade 2) and LaTeX math expressions (Nemeth)
into Unicode Braille strings and 6-bit dot-pattern lists.

Rules from CLAUDE.md:
- NEVER write Nemeth logic from scratch. Use liblouis.
- Import louis inside try/except so the module is importable without liblouis
  (tests run on CI where liblouis may not be present).

Examples:
    >>> from backend.services.translator import translate_text, BrailleGrade
    >>> result = translate_text("hi", BrailleGrade.GRADE_1)
    >>> result.cell_count
    2
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum

try:
    import louis  # type: ignore[import-untyped]
    _LOUIS_AVAILABLE: bool = True
except ImportError:
    _LOUIS_AVAILABLE = False

# Unicode Braille block starts at U+2800.
_BRAILLE_UNICODE_OFFSET = 0x2800

# liblouis table names — verified at runtime via check_tables_available().
_TABLE_GRADE1 = "en-us-g1.ctb"
_TABLE_GRADE2 = "en-us-g2.ctb"
_TABLE_NEMETH = "nemeth.ctb"


class BrailleGrade(str, Enum):
    """Supported translation modes."""

    GRADE_1 = "grade1"
    GRADE_2 = "grade2"
    NEMETH = "nemeth"


@dataclass
class TranslationResult:
    """Output produced by a single translation call.

    Attributes:
        input_text:     Original string passed to the translator.
        grade:          BrailleGrade used for translation.
        braille_unicode: Translated string using Unicode Braille characters
                         (U+2800–U+283F).
        dot_patterns:   List of 6-bit integers (0–63), one per Braille cell.
        cell_count:     Number of Braille cells produced.
    """

    input_text: str
    grade: BrailleGrade
    braille_unicode: str
    dot_patterns: list[int] = field(default_factory=list)
    cell_count: int = 0

    def to_dict(self) -> dict:
        """Return a JSON-serialisable representation.

        Examples:
            >>> r = TranslationResult("hi", BrailleGrade.GRADE_1, "\\u2803\\u2801", [3, 1], 2)
            >>> d = r.to_dict()
            >>> d["cell_count"]
            2
            >>> d["grade"]
            'grade1'
        """
        return {
            "input_text": self.input_text,
            "grade": self.grade.value,
            "braille_unicode": self.braille_unicode,
            "dot_patterns": self.dot_patterns,
            "cell_count": self.cell_count,
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _unicode_to_dot_patterns(s: str) -> list[int]:
    """Convert a Unicode Braille string to a list of 6-bit dot-pattern ints.

    Each character must be in the Unicode Braille block (U+2800–U+283F).
    Characters outside that range are silently skipped (liblouis sometimes
    emits space characters U+0020 as padding; callers should filter as needed).

    Args:
        s: String composed of Unicode Braille characters.

    Returns:
        List of integers in [0, 63], one per Braille character found.

    Examples:
        >>> _unicode_to_dot_patterns("\\u2800")
        [0]
        >>> _unicode_to_dot_patterns("\\u2801")
        [1]
        >>> _unicode_to_dot_patterns("\\u283F")
        [63]
        >>> _unicode_to_dot_patterns("")
        []
    """
    patterns: list[int] = []
    for ch in s:
        code = ord(ch)
        offset = code - _BRAILLE_UNICODE_OFFSET
        if 0 <= offset <= 63:
            patterns.append(offset)
    return patterns


def _table_for_grade(grade: BrailleGrade) -> str:
    mapping = {
        BrailleGrade.GRADE_1: _TABLE_GRADE1,
        BrailleGrade.GRADE_2: _TABLE_GRADE2,
        BrailleGrade.NEMETH: _TABLE_NEMETH,
    }
    return mapping[grade]


def _table_list(table_name: str) -> list[str]:
    """Return the translateString table list, prepending unicode.dis when available.

    Real liblouis on Linux/macOS returns internal ASCII from translateString by
    default. Prepending unicode.dis makes it output Unicode Braille (U+2800+).
    The Windows pure-Python shim ignores the table list and always outputs
    Unicode Braille, so this is safe on all platforms.

    Note: listTables() only returns translation tables (.ctb/.utb), NOT display
    tables (.dis). We check for unicode.dis by inspecting the tables directory
    directly, derived from the path of any translation table entry.
    """
    try:
        all_tables = louis.listTables()
        if all_tables:
            # Extract the directory containing the translation tables.
            tables_dir = os.path.dirname(all_tables[0])
            if tables_dir and os.path.exists(
                os.path.join(tables_dir, "unicode.dis")
            ):
                return ["unicode.dis", table_name]
    except Exception:
        pass
    return [table_name]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def translate_text(
    text: str,
    grade: BrailleGrade = BrailleGrade.GRADE_1,
) -> TranslationResult:
    """Translate plain text to Braille using liblouis.

    Args:
        text:  Input string (plain text, not LaTeX).
        grade: BrailleGrade.GRADE_1 or BrailleGrade.GRADE_2.
               Pass LaTeX through translate_math() instead.

    Returns:
        TranslationResult with unicode Braille and dot patterns.

    Raises:
        RuntimeError: If liblouis is not installed.
        ValueError:   If grade is BrailleGrade.NEMETH (use translate_math).

    Examples:
        >>> result = translate_text("hi")
        >>> result.cell_count
        2
        >>> result.grade
        <BrailleGrade.GRADE_1: 'grade1'>
    """
    if not _LOUIS_AVAILABLE:
        raise RuntimeError(
            "liblouis is not installed. Run 'make check-louis' or scripts/setup.sh."
        )
    if grade is BrailleGrade.NEMETH:
        raise ValueError(
            "Use translate_math() for Nemeth/LaTeX input, not translate_text()."
        )

    table = _table_for_grade(grade)
    braille_unicode: str = louis.translateString(_table_list(table), text)
    dot_patterns = _unicode_to_dot_patterns(braille_unicode)

    return TranslationResult(
        input_text=text,
        grade=grade,
        braille_unicode=braille_unicode,
        dot_patterns=dot_patterns,
        cell_count=len(dot_patterns),
    )


def translate_math(latex: str) -> TranslationResult:
    """Translate a LaTeX math expression to Nemeth Braille using liblouis.

    Nemeth Braille is the standard notation for mathematics. liblouis handles
    indicator cells, numeric mode, superscripts, etc. automatically — do NOT
    manually construct Nemeth sequences.

    Args:
        latex: LaTeX expression, e.g. "x^2 + 3x + 2 = 0".

    Returns:
        TranslationResult with grade=NEMETH and Nemeth dot patterns.

    Raises:
        RuntimeError: If liblouis is not installed or nemeth.ctb is unavailable.

    Examples:
        >>> result = translate_math("1 + 1 = 2")
        >>> isinstance(result.dot_patterns, list)
        True
    """
    if not _LOUIS_AVAILABLE:
        raise RuntimeError(
            "liblouis is not installed. Run 'make check-louis' or scripts/setup.sh."
        )

    tables = check_tables_available()
    if not tables.get("nemeth"):
        raise RuntimeError(
            "nemeth.ctb table is not available in this liblouis installation."
        )

    braille_unicode: str = louis.translateString(_table_list(_TABLE_NEMETH), latex)
    dot_patterns = _unicode_to_dot_patterns(braille_unicode)

    return TranslationResult(
        input_text=latex,
        grade=BrailleGrade.NEMETH,
        braille_unicode=braille_unicode,
        dot_patterns=dot_patterns,
        cell_count=len(dot_patterns),
    )


def check_tables_available() -> dict[str, bool]:
    """Check which liblouis translation tables are available.

    Useful as a health check (e.g. the /health endpoint can report this).
    Returns False for every key if liblouis is not installed at all.

    Returns:
        dict with keys 'grade1', 'grade2', 'nemeth', each mapping to bool.

    Examples:
        >>> tables = check_tables_available()
        >>> isinstance(tables["grade1"], bool)
        True
        >>> set(tables.keys()) >= {"grade1", "grade2", "nemeth"}
        True
    """
    if not _LOUIS_AVAILABLE:
        return {"grade1": False, "grade2": False, "nemeth": False}

    # listTables() returns full paths on Linux (/usr/share/liblouis/tables/foo.ctb).
    # Compare basenames so the check works on all platforms.
    available_basenames = [os.path.basename(t) for t in louis.listTables()]
    return {
        "grade1": _TABLE_GRADE1 in available_basenames,
        "grade2": _TABLE_GRADE2 in available_basenames,
        "nemeth": _TABLE_NEMETH in available_basenames,
    }

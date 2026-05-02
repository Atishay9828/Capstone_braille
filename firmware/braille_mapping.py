"""
braille_mapping.py - Braille Symbol Mapping Data

This module contains all Braille symbol mappings for Grade 1 (uncontracted)
English Braille. It provides structured data only - no conversion logic.

BRAILLE CELL REPRESENTATION:
----------------------------
We use a tuple of active dot numbers (1-6) as our internal representation.

    Dot positions:     Example: Letter 'a' = dot 1 only
    [1] [4]                    (1,)
    [2] [5]
    [3] [6]

Why this representation:
- Human-readable: (1, 2) is clearer than "110000"
- Easy to iterate for hardware actuation later
- Matches standard Braille documentation conventions
- Immutable tuples prevent accidental modification

An empty tuple () represents a blank cell (space).
"""

# ============================================================================
# SPECIAL INDICATORS
# ============================================================================
# These prefixes modify the meaning of the following character(s)

# Capital indicator: Dots 6 - placed before uppercase letters
CAPITAL_INDICATOR = (6,)

# Number indicator: Dots 3,4,5,6 - placed before digit sequences
NUMBER_INDICATOR = (3, 4, 5, 6)

# ============================================================================
# LOWERCASE LETTERS (a-z)
# ============================================================================
# Standard Grade 1 Braille alphabet

LETTERS = {
    'a': (1,),
    'b': (1, 2),
    'c': (1, 4),
    'd': (1, 4, 5),
    'e': (1, 5),
    'f': (1, 2, 4),
    'g': (1, 2, 4, 5),
    'h': (1, 2, 5),
    'i': (2, 4),
    'j': (2, 4, 5),
    'k': (1, 3),
    'l': (1, 2, 3),
    'm': (1, 3, 4),
    'n': (1, 3, 4, 5),
    'o': (1, 3, 5),
    'p': (1, 2, 3, 4),
    'q': (1, 2, 3, 4, 5),
    'r': (1, 2, 3, 5),
    's': (2, 3, 4),
    't': (2, 3, 4, 5),
    'u': (1, 3, 6),
    'v': (1, 2, 3, 6),
    'w': (2, 4, 5, 6),
    'x': (1, 3, 4, 6),
    'y': (1, 3, 4, 5, 6),
    'z': (1, 3, 5, 6),
}

# ============================================================================
# DIGITS (0-9)
# ============================================================================
# In Braille, digits use the same patterns as letters a-j,
# but are preceded by the number indicator.
# The mapping here is the cell pattern AFTER the number indicator.

DIGITS = {
    '1': (1,),           # Same pattern as 'a'
    '2': (1, 2),         # Same pattern as 'b'
    '3': (1, 4),         # Same pattern as 'c'
    '4': (1, 4, 5),      # Same pattern as 'd'
    '5': (1, 5),         # Same pattern as 'e'
    '6': (1, 2, 4),      # Same pattern as 'f'
    '7': (1, 2, 4, 5),   # Same pattern as 'g'
    '8': (1, 2, 5),      # Same pattern as 'h'
    '9': (2, 4),         # Same pattern as 'i'
    '0': (2, 4, 5),      # Same pattern as 'j'
}

# ============================================================================
# PUNCTUATION
# ============================================================================
# Common punctuation marks supported in this implementation

PUNCTUATION = {
    '.': (2, 5, 6),       # Period / full stop
    ',': (2,),            # Comma
    '?': (2, 3, 6),       # Question mark
    '!': (2, 3, 5),       # Exclamation mark
    "'": (3,),            # Apostrophe
    '-': (3, 6),          # Hyphen
    ':': (2, 5),          # Colon
    ';': (2, 3),          # Semicolon
    '(': (1, 2, 6),       # Opening parenthesis (same as closing)
    ')': (3, 4, 5),       # Closing parenthesis
}

# ============================================================================
# SPACE
# ============================================================================
# Space is represented as an empty cell (no raised dots)

SPACE = ()

# ============================================================================
# COMBINED MAPPING
# ============================================================================
# All single-character mappings combined for convenience.
# Does NOT include uppercase (handled via indicator + lowercase).

ALL_CHARACTERS = {}
ALL_CHARACTERS.update(LETTERS)
ALL_CHARACTERS.update(DIGITS)
ALL_CHARACTERS.update(PUNCTUATION)
ALL_CHARACTERS[' '] = SPACE

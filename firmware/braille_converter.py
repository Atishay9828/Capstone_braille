"""
braille_converter.py - Text to Braille Conversion Logic

This module provides the core logic for converting text input into
Braille representation. It handles:
- Lowercase and uppercase letters
- Digits with number indicator
- Basic punctuation
- Graceful handling of unsupported characters

DESIGN PRINCIPLES:
------------------
1. Deterministic: Same input always produces same output
2. Modular: Mapping data is separate from conversion logic
3. Extensible: Easy to add languages or Grade 2 support later
4. No hardware assumptions: Output is purely logical
"""

from typing import List, Tuple, Optional

from braille_mapping import (
    LETTERS,
    DIGITS,
    PUNCTUATION,
    SPACE,
    CAPITAL_INDICATOR,
    NUMBER_INDICATOR,
)

# Type alias for clarity: a Braille cell is a tuple of dot numbers
BrailleCell = Tuple[int, ...]


class BrailleConverter:
    """
    Converts text strings into Braille cell sequences.
    
    This class encapsulates the conversion logic and maintains
    state for number mode (consecutive digits share one indicator).
    """

    def __init__(self, skip_unknown: bool = False):
        """
        Initialize the converter.
        
        Args:
            skip_unknown: If True, silently skip unsupported characters.
                         If False (default), raise ValueError for unknown chars.
        """
        self.skip_unknown = skip_unknown

    def convert(self, text: str) -> List[BrailleCell]:
        """
        Convert a text string to a list of Braille cells.
        
        Args:
            text: The input string to convert.
            
        Returns:
            A list of BrailleCell tuples representing the Braille output.
            
        Raises:
            ValueError: If an unsupported character is encountered
                       and skip_unknown is False.
        """
        result: List[BrailleCell] = []
        in_number_mode = False  # Track if we're in a sequence of digits
        
        for char in text:
            cells = self._convert_character(char, in_number_mode)
            
            if cells is None:
                # Unsupported character
                if self.skip_unknown:
                    continue
                else:
                    raise ValueError(f"Unsupported character: '{char}' (ord={ord(char)})")
            
            # Update number mode state
            # Number mode ends when we encounter a non-digit
            if char.isdigit():
                in_number_mode = True
            elif char != ' ':
                # Space doesn't break number mode in some contexts,
                # but for simplicity we end it on any non-digit
                in_number_mode = False
            else:
                # Space encountered - number mode ends
                in_number_mode = False
            
            result.extend(cells)
        
        return result

    def _convert_character(
        self, char: str, in_number_mode: bool
    ) -> Optional[List[BrailleCell]]:
        """
        Convert a single character to its Braille cell(s).
        
        Args:
            char: A single character to convert.
            in_number_mode: Whether we're currently in a digit sequence.
            
        Returns:
            A list of BrailleCell tuples, or None if unsupported.
        """
        cells: List[BrailleCell] = []
        
        # Handle space
        if char == ' ':
            return [SPACE]
        
        # Handle uppercase letters
        if char.isupper():
            lower_char = char.lower()
            if lower_char in LETTERS:
                cells.append(CAPITAL_INDICATOR)
                cells.append(LETTERS[lower_char])
                return cells
            # Uppercase but not a letter - fall through to check other mappings
        
        # Handle lowercase letters
        if char in LETTERS:
            return [LETTERS[char]]
        
        # Handle digits
        if char in DIGITS:
            if not in_number_mode:
                # First digit in sequence - add number indicator
                cells.append(NUMBER_INDICATOR)
            cells.append(DIGITS[char])
            return cells
        
        # Handle punctuation
        if char in PUNCTUATION:
            return [PUNCTUATION[char]]
        
        # Unsupported character
        return None

    def convert_to_string(self, text: str, cell_separator: str = " ") -> str:
        """
        Convert text to a human-readable Braille string representation.
        
        This is useful for debugging and testing. Each cell is shown
        as a hyphen-separated list of dot numbers.
        
        Args:
            text: The input string to convert.
            cell_separator: String to place between cells (default: space).
            
        Returns:
            A string representation of the Braille output.
            
        Example:
            "Hi" -> "6 125 24" (capital indicator, h, i)
        """
        cells = self.convert(text)
        
        cell_strings = []
        for cell in cells:
            if len(cell) == 0:
                cell_strings.append("_")  # Visual marker for space/blank
            else:
                # Join dot numbers without separator for compactness
                cell_strings.append("".join(str(d) for d in cell))
        
        return cell_separator.join(cell_strings)


def convert_text_to_braille(text: str, skip_unknown: bool = False) -> List[BrailleCell]:
    """
    Convenience function for one-off conversions.
    
    Args:
        text: The input string to convert.
        skip_unknown: If True, silently skip unsupported characters.
        
    Returns:
        A list of BrailleCell tuples.
    """
    converter = BrailleConverter(skip_unknown=skip_unknown)
    return converter.convert(text)


def format_braille_cells(cells: List[BrailleCell]) -> str:
    """
    Format a list of Braille cells as a readable string.
    
    Args:
        cells: List of BrailleCell tuples.
        
    Returns:
        Human-readable string representation.
    """
    parts = []
    for cell in cells:
        if len(cell) == 0:
            parts.append("[SPACE]")
        else:
            parts.append(f"[{','.join(str(d) for d in cell)}]")
    return " ".join(parts)

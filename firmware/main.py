"""
main.py - Braille Converter Test Runner

This module demonstrates the text-to-Braille conversion functionality.
It runs sample conversions to verify correctness of the implementation.

This is a simple test runner - no UI, CLI parsing, or hardware code.
"""

from braille_converter import BrailleConverter, format_braille_cells


def run_demo():
    """
    Demonstrate Braille conversion with various test cases.
    """
    print("=" * 60)
    print("BRAILLE CONVERTER - DEMONSTRATION")
    print("=" * 60)
    print()
    
    # Create converter instance
    converter = BrailleConverter(skip_unknown=True)
    
    # Test cases covering different scenarios
    test_cases = [
        # Lowercase letters
        ("hello", "Lowercase text"),
        
        # Mixed case
        ("Hello", "Mixed case (capital indicator)"),
        ("HELLO", "All uppercase"),
        
        # Numbers
        ("123", "Digits (with number indicator)"),
        ("Room 101", "Text with embedded number"),
        
        # Punctuation
        ("Hi!", "Exclamation mark"),
        ("What?", "Question mark"),
        ("Yes, no.", "Comma and period"),
        
        # Mixed content
        ("Hello, World!", "Complete sentence"),
        ("Call 911!", "Mixed text, numbers, punctuation"),
        
        # Edge cases
        ("a", "Single lowercase letter"),
        ("A", "Single uppercase letter"),
        ("1", "Single digit"),
        (" ", "Single space"),
    ]
    
    for text, description in test_cases:
        print(f"Test: {description}")
        print(f"  Input:  '{text}'")
        
        # Get Braille cells
        cells = converter.convert(text)
        
        # Display compact notation
        compact = converter.convert_to_string(text)
        print(f"  Compact: {compact}")
        
        # Display detailed notation
        detailed = format_braille_cells(cells)
        print(f"  Detailed: {detailed}")
        
        print()
    
    print("=" * 60)
    print("DEMONSTRATION COMPLETE")
    print("=" * 60)


def run_validation():
    """
    Run basic validation checks to ensure correctness.
    """
    print()
    print("Running validation checks...")
    print()
    
    converter = BrailleConverter()
    errors = []
    
    # Validation 1: Deterministic output
    text = "Hello World 123"
    result1 = converter.convert(text)
    result2 = converter.convert(text)
    if result1 != result2:
        errors.append("FAIL: Non-deterministic output detected")
    else:
        print("✓ Deterministic output verified")
    
    # Validation 2: Capital indicator present for uppercase
    cells = converter.convert("A")
    if len(cells) != 2:  # Should be: capital indicator + 'a'
        errors.append("FAIL: Capital indicator missing for 'A'")
    else:
        print("✓ Capital indicator correctly applied")
    
    # Validation 3: Number indicator for digits
    cells = converter.convert("1")
    if len(cells) != 2:  # Should be: number indicator + '1'
        errors.append("FAIL: Number indicator missing for '1'")
    else:
        print("✓ Number indicator correctly applied")
    
    # Validation 4: Consecutive digits share one indicator
    cells = converter.convert("12")
    if len(cells) != 3:  # Should be: number indicator + '1' + '2'
        errors.append(f"FAIL: Expected 3 cells for '12', got {len(cells)}")
    else:
        print("✓ Consecutive digits correctly handled")
    
    # Validation 5: Space produces empty cell
    cells = converter.convert(" ")
    if len(cells) != 1 or cells[0] != ():
        errors.append("FAIL: Space not producing empty cell")
    else:
        print("✓ Space correctly produces empty cell")
    
    print()
    if errors:
        print("VALIDATION FAILED:")
        for err in errors:
            print(f"  - {err}")
    else:
        print("ALL VALIDATION CHECKS PASSED ✓")
    
    return len(errors) == 0


if __name__ == "__main__":
    run_demo()
    success = run_validation()
    
    # Exit with appropriate code for automated testing
    exit(0 if success else 1)

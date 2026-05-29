"""Cam-angle lookup table for the Braillix cam disc (L3 boundary).

The cam disc has 64 angular positions, one for each 6-bit Braille dot pattern
(0–63). Patterns are mapped sequentially so the hardware team can mark the cam
accordingly:

    cam_angle_degrees = pattern_index * (360.0 / 64)  →  5.625° per step

This is a pure-math module. No hardware calls, no HAL imports.

Examples:
    >>> pattern_to_angle(0)
    0.0
    >>> pattern_to_angle(1)
    5.625
    >>> pattern_to_angle(63)
    354.375
"""

NUM_CAM_POSITIONS: int = 64
DEGREES_PER_STEP: float = 360.0 / NUM_CAM_POSITIONS  # 5.625
BLANK_PATTERN: int = 0
HOME_ANGLE: float = 0.0

# Precomputed at import time — never recomputed on each call.
_LOOKUP: dict[int, float] = {
    i: i * DEGREES_PER_STEP for i in range(NUM_CAM_POSITIONS)
}


def pattern_to_angle(dot_pattern: int) -> float:
    """Return the cam angle (degrees) for a 6-bit Braille dot pattern.

    Args:
        dot_pattern: Integer in [0, 63] representing a 6-bit Braille cell.

    Returns:
        Angle in degrees in [0.0, 359.xxx].

    Raises:
        ValueError: If dot_pattern is outside [0, 63].

    Examples:
        >>> pattern_to_angle(0)
        0.0
        >>> pattern_to_angle(1)
        5.625
        >>> pattern_to_angle(32)
        180.0
        >>> pattern_to_angle(63)
        354.375
    """
    if dot_pattern not in _LOOKUP:
        raise ValueError(
            f"dot_pattern must be in [0, 63], got {dot_pattern!r}"
        )
    return _LOOKUP[dot_pattern]


def angle_to_pattern(angle_degrees: float, tolerance: float = 0.1) -> int:
    """Return the dot pattern whose cam angle is closest to angle_degrees.

    The angle is first normalised into [0, 360) before lookup.

    Args:
        angle_degrees: Target angle in degrees (any value; will be normalised).
        tolerance: Maximum allowed deviation in degrees from the nearest
            discrete cam position. Defaults to 0.1°.

    Returns:
        Integer pattern in [0, 63].

    Raises:
        ValueError: If the nearest discrete angle is further than *tolerance*
            degrees from angle_degrees.

    Examples:
        >>> angle_to_pattern(0.0)
        0
        >>> angle_to_pattern(5.625)
        1
        >>> angle_to_pattern(360.0)   # normalises to 0.0
        0
        >>> angle_to_pattern(5.7, tolerance=0.1)
        Traceback (most recent call last):
            ...
        ValueError: ...
    """
    normalised = angle_degrees % 360.0
    # Find the nearest pattern index.
    nearest = round(normalised / DEGREES_PER_STEP) % NUM_CAM_POSITIONS
    snap_angle = nearest * DEGREES_PER_STEP
    diff = abs(normalised - snap_angle)
    # Account for wrap-around (e.g. 359.9 vs 0.0).
    diff = min(diff, 360.0 - diff)
    if diff > tolerance:
        raise ValueError(
            f"No cam position within {tolerance}° of {angle_degrees}° "
            f"(nearest is {snap_angle}° for pattern {nearest}, off by {diff:.4f}°)"
        )
    return nearest


def get_full_lookup_table() -> dict[int, float]:
    """Return a copy of the full pattern → angle lookup table.

    Returns a *copy* so callers cannot mutate the precomputed table.

    Returns:
        dict mapping each integer pattern (0–63) to its cam angle (degrees).

    Examples:
        >>> table = get_full_lookup_table()
        >>> len(table)
        64
        >>> table[0]
        0.0
        >>> table[63]
        354.375
    """
    return dict(_LOOKUP)


def angular_distance(pattern_a: int, pattern_b: int) -> float:
    """Return the shortest angular distance (in degrees) between two patterns.

    Because the cam is circular, the maximum possible distance is 180°.

    Args:
        pattern_a: First pattern, in [0, 63].
        pattern_b: Second pattern, in [0, 63].

    Returns:
        Shortest arc distance in degrees, in [0.0, 180.0].

    Raises:
        ValueError: If either pattern is outside [0, 63].

    Examples:
        >>> angular_distance(0, 0)
        0.0
        >>> angular_distance(0, 1)
        5.625
        >>> angular_distance(0, 32)
        180.0
        >>> angular_distance(1, 0)
        5.625
    """
    angle_a = pattern_to_angle(pattern_a)
    angle_b = pattern_to_angle(pattern_b)
    diff = abs(angle_a - angle_b)
    return min(diff, 360.0 - diff)


def braille_sequence_to_angles(patterns: list[int]) -> list[float]:
    """Convert a sequence of Braille dot patterns to a list of cam angles.

    Args:
        patterns: List of integers, each in [0, 63].

    Returns:
        List of cam angles (degrees), same length as *patterns*.

    Raises:
        ValueError: If any pattern is outside [0, 63].

    Examples:
        >>> braille_sequence_to_angles([])
        []
        >>> braille_sequence_to_angles([0, 1, 2])
        [0.0, 5.625, 11.25]
    """
    return [pattern_to_angle(p) for p in patterns]

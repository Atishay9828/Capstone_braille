"""Tests for backend/services/cam_angles.py.

No external dependencies — runs without liblouis or any hardware.
"""

import pytest

from backend.services.cam_angles import (
    NUM_CAM_POSITIONS,
    DEGREES_PER_STEP,
    BLANK_PATTERN,
    HOME_ANGLE,
    angle_to_pattern,
    angular_distance,
    braille_sequence_to_angles,
    get_full_lookup_table,
    pattern_to_angle,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

class TestConstants:
    def test_num_cam_positions(self):
        assert NUM_CAM_POSITIONS == 64

    def test_degrees_per_step(self):
        assert DEGREES_PER_STEP == pytest.approx(5.625)

    def test_blank_pattern(self):
        assert BLANK_PATTERN == 0

    def test_home_angle(self):
        assert HOME_ANGLE == 0.0


# ---------------------------------------------------------------------------
# pattern_to_angle
# ---------------------------------------------------------------------------

class TestPatternToAngle:
    def test_blank_is_zero(self):
        assert pattern_to_angle(0) == pytest.approx(0.0)

    def test_pattern_1(self):
        assert pattern_to_angle(1) == pytest.approx(5.625)

    def test_pattern_63(self):
        assert pattern_to_angle(63) == pytest.approx(354.375)

    def test_all_64_valid(self):
        for i in range(64):
            angle = pattern_to_angle(i)
            assert isinstance(angle, float)

    def test_evenly_spaced(self):
        angles = [pattern_to_angle(i) for i in range(64)]
        diffs = [angles[i + 1] - angles[i] for i in range(63)]
        for d in diffs:
            assert d == pytest.approx(DEGREES_PER_STEP)

    def test_all_unique(self):
        angles = [pattern_to_angle(i) for i in range(64)]
        assert len(set(angles)) == 64

    def test_invalid_negative(self):
        with pytest.raises(ValueError):
            pattern_to_angle(-1)

    def test_invalid_64(self):
        with pytest.raises(ValueError):
            pattern_to_angle(64)

    def test_invalid_float_rejected(self):
        with pytest.raises((ValueError, TypeError, KeyError)):
            pattern_to_angle(1.5)  # type: ignore[arg-type]

    @pytest.mark.parametrize("pattern", list(range(64)))
    def test_all_patterns_parametrized(self, pattern: int):
        angle = pattern_to_angle(pattern)
        assert angle == pytest.approx(pattern * DEGREES_PER_STEP)


# ---------------------------------------------------------------------------
# angle_to_pattern
# ---------------------------------------------------------------------------

class TestAngleToPattern:
    @pytest.mark.parametrize("pattern", list(range(64)))
    def test_round_trip_identity(self, pattern: int):
        """pattern → angle → pattern must be the identity for all 64 patterns."""
        angle = pattern_to_angle(pattern)
        recovered = angle_to_pattern(angle)
        assert recovered == pattern

    def test_360_normalises_to_0(self):
        assert angle_to_pattern(360.0) == 0

    def test_negative_normalises(self):
        # -5.625 should normalise to 354.375 → pattern 63
        assert angle_to_pattern(-5.625) == 63

    def test_tolerance_accepted(self):
        # 5.625 + 0.05 is within default tolerance of 0.1
        result = angle_to_pattern(5.625 + 0.05)
        assert result == 1

    def test_out_of_tolerance_raises(self):
        with pytest.raises(ValueError):
            angle_to_pattern(5.625 + 0.2, tolerance=0.1)

    def test_zero_angle(self):
        assert angle_to_pattern(0.0) == 0

    def test_exact_midpoint_snaps(self):
        # 180.0 is exactly pattern 32
        assert angle_to_pattern(180.0) == 32


# ---------------------------------------------------------------------------
# get_full_lookup_table
# ---------------------------------------------------------------------------

class TestGetFullLookupTable:
    def test_64_entries(self):
        assert len(get_full_lookup_table()) == 64

    def test_returns_copy_not_reference(self):
        t1 = get_full_lookup_table()
        t2 = get_full_lookup_table()
        assert t1 is not t2

    def test_mutation_does_not_affect_module(self):
        table = get_full_lookup_table()
        table[0] = 999.0
        assert pattern_to_angle(0) == pytest.approx(0.0)

    def test_values_match_pattern_to_angle(self):
        table = get_full_lookup_table()
        for pattern, angle in table.items():
            assert angle == pytest.approx(pattern_to_angle(pattern))

    def test_keys_are_0_to_63(self):
        assert set(get_full_lookup_table().keys()) == set(range(64))


# ---------------------------------------------------------------------------
# angular_distance
# ---------------------------------------------------------------------------

class TestAngularDistance:
    def test_same_pattern_is_zero(self):
        for p in [0, 1, 32, 63]:
            assert angular_distance(p, p) == pytest.approx(0.0)

    def test_adjacent_patterns(self):
        assert angular_distance(0, 1) == pytest.approx(DEGREES_PER_STEP)

    def test_symmetric(self):
        for a, b in [(0, 1), (0, 32), (1, 63), (10, 50)]:
            assert angular_distance(a, b) == pytest.approx(angular_distance(b, a))

    def test_max_is_180(self):
        # patterns 0 and 32 are exactly 180° apart
        assert angular_distance(0, 32) == pytest.approx(180.0)

    def test_wrap_around(self):
        # patterns 0 and 63 are 1 step apart going the short way around
        assert angular_distance(0, 63) == pytest.approx(DEGREES_PER_STEP)

    def test_invalid_pattern_raises(self):
        with pytest.raises(ValueError):
            angular_distance(-1, 0)
        with pytest.raises(ValueError):
            angular_distance(0, 64)

    @pytest.mark.parametrize("a,b", [(0, 16), (16, 32), (32, 48)])
    def test_quarter_circle(self, a: int, b: int):
        assert angular_distance(a, b) == pytest.approx(90.0)


# ---------------------------------------------------------------------------
# braille_sequence_to_angles
# ---------------------------------------------------------------------------

class TestBrailleSequenceToAngles:
    def test_empty_list(self):
        assert braille_sequence_to_angles([]) == []

    def test_single_pattern(self):
        assert braille_sequence_to_angles([0]) == [pytest.approx(0.0)]

    def test_multiple_patterns(self):
        result = braille_sequence_to_angles([0, 1, 2])
        assert result == [pytest.approx(0.0), pytest.approx(5.625), pytest.approx(11.25)]

    def test_length_matches_input(self):
        patterns = [0, 10, 20, 30, 40, 50, 63]
        result = braille_sequence_to_angles(patterns)
        assert len(result) == len(patterns)

    def test_invalid_pattern_raises(self):
        with pytest.raises(ValueError):
            braille_sequence_to_angles([0, 1, 64])

    def test_all_results_are_floats(self):
        result = braille_sequence_to_angles(list(range(64)))
        assert all(isinstance(a, float) for a in result)

    def test_home_sequence(self):
        # All-blank sequence maps to all HOME_ANGLE
        result = braille_sequence_to_angles([BLANK_PATTERN] * 5)
        assert result == [pytest.approx(HOME_ANGLE)] * 5

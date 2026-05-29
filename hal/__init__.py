# =============================================================================
# HAL — Hardware Abstraction Layer
#
# OWNERSHIP:
#   BrailleHAL (ABC) and SimulatorHAL — defined here for dev use.
#   CamMotorHAL — ANIKET OWNS THIS CLASS. Shaurya does NOT modify CamMotorHAL.
#
# Layer contract: L5/L4/L3 code calls BrailleHAL methods only.
# Never talk to GPIO directly.
# =============================================================================

from __future__ import annotations

from abc import ABC, abstractmethod


class BrailleHAL(ABC):
    """Abstract base for all Braille display hardware adapters.

    Bit encoding (LSB = dot 1):
        Bit 0 = dot 1 (top-left)
        Bit 1 = dot 2 (middle-left)
        Bit 2 = dot 3 (bottom-left)
        Bit 3 = dot 4 (top-right)
        Bit 4 = dot 5 (middle-right)
        Bit 5 = dot 6 (bottom-right)

    Braille cell layout:
        1  4
        2  5
        3  6

    Examples:
        dot 1 only  → 0b000001 = 1
        dots 1,2    → 0b000011 = 3
        dots 1,2,5  → 0b010011 = 19   (letter 'h' in Grade 1)
        all 6 dots  → 0b111111 = 63
    """

    @abstractmethod
    def display_pattern(self, cell_index: int, dots: int) -> None:
        """Raise or lower pins on a single Braille cell.

        Args:
            cell_index: Zero-based index of the cell to update.
            dots: 6-bit pattern in [0, 63]. Bit N controls dot N+1.

        Blocking: returns only when pins are physically in position.
        """

    @abstractmethod
    def home(self) -> None:
        """Reset all cells to blank (pattern 0x00)."""

    @abstractmethod
    def get_status(self) -> dict:
        """Return current display state.

        Returns:
            dict with keys:
                'cells'            — total number of cells
                'busy'             — True while a motor move is in progress
                'errors'           — list of error strings (empty when healthy)
                'current_patterns' — list[int] of current dot pattern per cell
        """


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _dots_raised(dots: int) -> list[int]:
    """Return the dot numbers (1–6) that are raised in a 6-bit pattern."""
    return [bit + 1 for bit in range(6) if (dots >> bit) & 1]


# ---------------------------------------------------------------------------
# SimulatorHAL — software-only stand-in for integration tests and demos
# ---------------------------------------------------------------------------

class SimulatorHAL(BrailleHAL):
    """In-process Braille display simulator. No hardware required.

    Prints a human-readable representation of each cell state to stdout
    so developers can verify the translation pipeline without hardware.

    Examples:
        >>> hal = SimulatorHAL(num_cells=2)
        >>> hal.display_pattern(0, 19)   # 'h' in Grade 1
        Cell[0] ⠓  dots=0b010011  (1,2,5 raised)
        >>> hal.home()
        SimulatorHAL: all 2 cells reset to blank.
    """

    def __init__(self, num_cells: int = 8) -> None:
        self._num_cells = num_cells
        self._state: list[int] = [0] * num_cells

    def display_pattern(self, cell_index: int, dots: int) -> None:
        """Validate inputs, update internal state, and print cell info."""
        if not (0 <= cell_index < self._num_cells):
            raise ValueError(
                f"cell_index {cell_index} out of range [0, {self._num_cells - 1}]"
            )
        if not (0 <= dots <= 63):
            raise ValueError(f"dots {dots} out of range [0, 63]")

        self._state[cell_index] = dots
        raised = _dots_raised(dots)
        braille_char = chr(0x2800 + dots)
        raised_str = ",".join(str(d) for d in raised) if raised else "none"
        print(f"Cell[{cell_index}] {braille_char}  dots=0b{dots:06b}  ({raised_str} raised)")

    def home(self) -> None:
        """Reset all cells to blank and announce it."""
        self._state = [0] * self._num_cells
        print(f"SimulatorHAL: all {self._num_cells} cells reset to blank.")

    def get_status(self) -> dict:
        """Return simulator status dict (never busy, never errors)."""
        return {
            "cells": self._num_cells,
            "busy": False,
            "errors": [],
            "current_patterns": list(self._state),
        }

    def display_string(self, patterns: list[int]) -> None:
        """Home the display, then show each pattern in sequence.

        Args:
            patterns: List of 6-bit dot patterns, one per cell.

        Raises:
            ValueError: If any pattern is out of range or the list is longer
                        than the number of available cells.
        """
        if len(patterns) > self._num_cells:
            raise ValueError(
                f"Got {len(patterns)} patterns but SimulatorHAL has only "
                f"{self._num_cells} cells."
            )
        self.home()
        for idx, dots in enumerate(patterns):
            self.display_pattern(idx, dots)


# ---------------------------------------------------------------------------
# CamMotorHAL — ANIKET OWNS THIS — DO NOT MODIFY
# ---------------------------------------------------------------------------

class CamMotorHAL(BrailleHAL):
    """Real hardware driver — cam-disc + stepper motor.

    OWNER: Aniket. Shaurya does NOT modify this class.
    Implementation lives in firmware/ and is filled in by Aniket's team.
    """

    def __init__(self, *args, **kwargs) -> None:
        raise NotImplementedError(
            "CamMotorHAL is owned by Aniket — hardware implementation not yet available. "
            "Use SimulatorHAL for development and testing."
        )

    def display_pattern(self, cell_index: int, dots: int) -> None:
        raise NotImplementedError("CamMotorHAL is owned by Aniket.")

    def home(self) -> None:
        raise NotImplementedError("CamMotorHAL is owned by Aniket.")

    def get_status(self) -> dict:
        raise NotImplementedError("CamMotorHAL is owned by Aniket.")

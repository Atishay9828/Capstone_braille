"""Shared pytest fixtures for the Braillix test suite."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from backend.main import app

# ---------------------------------------------------------------------------
# SimulatorHAL — attempt to import from hal; fall back to an in-process stub
# until Aniket implements the real SimulatorHAL in hal/__init__.py.
# ---------------------------------------------------------------------------
try:
    from hal import SimulatorHAL  # type: ignore[import-untyped]
except ImportError:
    class SimulatorHAL:  # type: ignore[no-redef]
        """Minimal in-memory stub. Replace with hal.SimulatorHAL when available."""

        def __init__(self) -> None:
            self._cells: dict[int, int] = {}

        def display_pattern(self, cell_index: int, dots: int) -> None:
            self._cells[cell_index] = dots

        def home(self) -> None:
            self._cells.clear()

        def get_status(self) -> dict:
            return {"cells": len(self._cells), "busy": False, "errors": []}


@pytest.fixture
def simulator_hal() -> SimulatorHAL:
    """Fresh SimulatorHAL instance per test."""
    return SimulatorHAL()


@pytest_asyncio.fixture
async def test_client() -> AsyncClient:
    """Async HTTP client wired directly to the FastAPI app (no server needed)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

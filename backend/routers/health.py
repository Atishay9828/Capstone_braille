from fastapi import APIRouter

from backend.models.schemas import HealthResponse
from backend.services.translator import _LOUIS_AVAILABLE, check_tables_available

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return service health including liblouis table availability."""
    tables = check_tables_available()
    status = "ok" if any(tables.values()) else "degraded"
    return HealthResponse(
        status=status,
        liblouis_available=_LOUIS_AVAILABLE,
        tables=tables,
    )

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import classroom, health, ocr, translate

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    from backend.services.translator import _LOUIS_AVAILABLE, check_tables_available

    if _LOUIS_AVAILABLE:
        tables = check_tables_available()
        logger.info("liblouis available. Table status: %s", tables)
    else:
        logger.warning(
            "liblouis NOT installed — translation endpoints will return 503. "
            "Run scripts/setup.sh to install."
        )

    from backend.core.db import create_all_tables
    create_all_tables()
    logger.info("SQLite tables ready.")

    yield
    # --- Shutdown ---


app = FastAPI(
    title="Braillix API",
    description=(
        "Backend for the Braillix refreshable Braille display. "
        "Converts text and LaTeX math into Braille dot patterns and cam angles."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow Harshita's frontend dev servers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(translate.router)
app.include_router(ocr.router)
app.include_router(classroom.router)   # Phase 3: WebSocket classroom


@app.get("/", tags=["root"])
async def root() -> dict:
    """Service info and links."""
    return {
        "service": "Braillix API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "translate_text": "POST /translate",
            "translate_math": "POST /translate-math",
            "cam_angles": "POST /translate/cam-angles",
            "process_pdf": "POST /ocr/process-pdf",
            "create_session": "POST /classroom/sessions",
            "teacher_ws": "WS /classroom/teacher/{code}",
            "student_ws": "WS /classroom/student/{code}",
        },
    }

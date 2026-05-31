# CLAUDE.md — Braillix Backend
## Project: CPG 128 · Braillix Refreshable Braille Display
## Owner: Shaurya Verma (Backend / Translation / OCR / ML)
## Team repo: github.com/Atishay9828/Capstone_braille

---

## What This Is

A low-cost (~₹3000) refreshable Braille display for visually impaired students.
The cam-driven hardware (single stepper motor + 64-state cam disc) raises Braille pins.
Shaurya's software stack converts ANY input → 6-bit dot pattern → motor angle → hardware.

Pipeline:
  User input (text / PDF / math image)
    → L4 Input Processor (Shaurya) — extracts clean text / LaTeX
    → L3 Translation Engine (Shaurya) — text/LaTeX → 6-bit Braille dot patterns
    → L2 HAL interface (Aniket) — display_pattern(cell_index, dots)
    → L1 Hardware driver (Aniket + hardware team)

---

## Layer Ownership — HARD BOUNDARIES

| Layer | Owner | Files |
|-------|-------|-------|
| L6 Frontend | Harshita | /frontend/ |
| L5 App Logic | **Shaurya** | /backend/main.py, routers/, core/ |
| L4 Input Processor | **Shaurya** | /backend/services/ocr_pipeline.py, pdf_processor.py |
| L3 Translation Engine | **Shaurya** | /backend/services/translator.py, cam_angles.py |
| L2 HAL | Aniket | /hal/__init__.py — DO NOT MODIFY |
| L1 Hardware Driver | Aniket + HW team | /firmware/ — DO NOT TOUCH |

**You are L3, L4, L5 only. Never skip the HAL. Never talk to GPIO directly.**

---

## Absolute Rules (Never Violate)

1. **NEVER** write Nemeth Braille translation logic from scratch. Use liblouis.
2. **NEVER** train a custom OCR model. Use pix2tex (Phase 1) or Pix2Text (Phase 2).
3. **NEVER** call hardware GPIO directly. All display calls go through `hal.BrailleHAL`.
4. **NEVER** use paid APIs. Everything must be free/open-source (liblouis, pix2tex, FastAPI, pytest).
5. **NEVER** merge without tests. Every service function has pytest coverage.
6. **NEVER** put business logic in route handlers. Routes call services; services do the work.

---

## Tech Stack

```
Python 3.11
FastAPI + uvicorn          # backend framework
python-louis (liblouis)    # text → Braille, LaTeX → Nemeth (THE core library)
pix2tex                    # math image → LaTeX OCR (Phase 2)
pdfplumber                 # PDF text extraction
pymupdf (fitz)             # PDF image extraction
latex2mathml               # LaTeX → MathML (bridge to liblouis Nemeth)
httpx                      # async HTTP client for tests
pytest + pytest-asyncio    # testing
SQLite                     # MVP database
```

---

## The Hardware-Software Contract (L2 — DO NOT MODIFY)

```python
# hal/__init__.py — Aniket owns this file
from abc import ABC, abstractmethod

class BrailleHAL(ABC):
    @abstractmethod
    def display_pattern(self, cell_index: int, dots: int) -> None:
        """Display 6-bit pattern (0-63) on cell at given index.
        
        Bit encoding (LSB = dot 1):
            Bit 0 = dot 1 (top-left)
            Bit 1 = dot 2 (middle-left)
            Bit 2 = dot 3 (bottom-left)
            Bit 3 = dot 4 (top-right)
            Bit 4 = dot 5 (middle-right)
            Bit 5 = dot 6 (bottom-right)
        
        Braille grid:
            1  4
            2  5
            3  6
        
        Blocking: returns only when dots are physically in position.
        """

    @abstractmethod
    def home(self) -> None:
        """Reset all cells to blank (pattern 0x00)."""

    @abstractmethod
    def get_status(self) -> dict:
        """Return {'cells': N, 'busy': bool, 'errors': [...]}"""
```

---

## Cam-Angle Mapping (L3 boundary — Shaurya builds this)

The cam disc has 64 angular positions. The hardware team encodes all 64 dot patterns
onto the cam. The software must output the correct angle for any given 6-bit pattern.

Sequential ordering (MVP — simplest, hardware marks cam accordingly):
  cam_angle_degrees = pattern_index * (360.0 / 64)  →  5.625° per step

This lives in: `backend/services/cam_angles.py`
It's a pure math module — no hardware calls, no imports from hal/.

---

## File Structure

```
/braillix/
  CLAUDE.md                    ← you are here
  requirements.txt
  Makefile
  .env.example

  /backend/
    main.py                    # FastAPI app entry + lifespan
    /routers/
      translate.py             # POST /translate, POST /translate-math
      ocr.py                   # POST /ocr-image, POST /process-pdf (Phase 2)
      health.py                # GET /health
    /services/
      translator.py            # L3: liblouis wrapper — text/LaTeX → Braille bits
      cam_angles.py            # cam angle lookup table (pure math)
      ocr_pipeline.py          # L4: pix2tex wrapper (Phase 2)
      pdf_processor.py         # L4: pdfplumber + pymupdf (Phase 2)
    /models/
      schemas.py               # Pydantic request/response models
    /core/
      config.py                # Settings (loaded from .env)

  /hal/
    __init__.py                # BrailleHAL ABC + SimulatorHAL (ANIKET OWNS)

  /tests/
    conftest.py                # fixtures: test client, mock HAL
    test_translator.py         # unit tests for translator.py
    test_cam_angles.py         # unit tests for cam_angles.py
    test_api.py                # integration tests for all endpoints

  /scripts/
    setup.sh                   # one-command dev environment setup
    demo.sh                    # runs the smoke test demo
```

---

## liblouis Quick Reference

```python
import louis

# Grade 1 (uncontracted — one Braille char per letter)
louis.translateString(["en-us-g1.ctb"], "hello")

# Grade 2 (contracted — uses abbreviations, harder to debug)
louis.translateString(["en-us-g2.ctb"], "hello")

# Nemeth math (what we use for equations)
louis.translateString(["nemeth.ctb"], "x^2 + 3x + 2 = 0")

# Check available tables
louis.listTables()

# Translate with back-translation map (debugging)
louis.translate(["en-us-g1.ctb"], "hello", typeform=None)
```

**Nemeth gotchas to watch:**
- Nemeth uses indicator cells that change the meaning of subsequent patterns
- Numeric mode indicator must precede numbers
- Superscript indicator needed for exponents
- liblouis handles most of this automatically — don't manually construct Nemeth

---

## Project Status: Phase 0–4 COMPLETE (backend done)

**Tests:** 511 passing / 0 failed / 0 skipped · CI green on Ubuntu.
**Run the whole demo:** `python scripts/demo_full.py --all` (add `--mock-ocr` to skip slow OCR).

### Endpoints (all live)
```
GET  /                              service info + endpoint index
GET  /health                        liblouis status + table availability
POST /translate                     text → Grade 1/2 Braille
POST /translate-math                LaTeX → Nemeth Braille
POST /translate/cam-angles          dot patterns → motor angles
POST /ocr/image                     math image → LaTeX (pix2tex)
POST /ocr/image-to-braille          image → Nemeth Braille (demo endpoint)
POST /ocr/process-pdf               PDF → Braille, per-page text/OCR routing
POST /classroom/sessions            create classroom session
GET/DELETE /classroom/sessions/{code}
WS   /classroom/teacher/{code}      teacher broadcast channel
WS   /classroom/student/{code}      student receive channel
POST /classroom/sessions/{code}/broadcast-math   broadcast Braille + MCQ
POST /classroom/sessions/{code}/submit-answer    student answers; updates BKT
GET  /classroom/sessions/{code}/performance      live class dashboard
POST /assessment/generate           LaTeX → MCQ (Braille-encoded, BKT-tracked)
POST /assessment/submit             grade + update Bayesian Knowledge Tracing
GET  /assessment/student/{id}       per-student mastery profile
```
Full contract: `docs/api-contract.md`.

### What's done (Shaurya — L3/L4/L5)
- L3 translation (liblouis Grade 1/2 + Nemeth), cam-angle math
- L4 OCR (pix2tex, benchmarked) + image preprocessing + PDF per-page routing
- L5 FastAPI app, WebSocket classroom, adaptive assessment (BKT + rule-based MCQs)
- SQLite persistence, GitHub Actions CI, Raspberry Pi deploy package, demo + report docs

### Remaining (other owners)
- **Harshita (L6):** frontend — build against `docs/api-contract.md`
- **Aniket (L2/L1):** implement `CamMotorHAL` behind the frozen `BrailleHAL` contract; GPIO
- **Shaurya (validation):** real-photo OCR test, one VI-student user-test session

### Demo day
Pi setup: `bash scripts/setup_pi.sh` → `bash scripts/health_check.sh` (must be all OK).
Runbook for hardware team: `docs/demo-day-runbook.md`.

---

## Testing Standards

```bash
# Run all tests
make test

# Run specific file
pytest tests/test_translator.py -v

# Run with coverage
pytest --cov=backend --cov-report=term-missing
```

Rules:
- Every public function in services/ has ≥1 test
- API tests use `httpx.AsyncClient` with `app` directly (no server needed)
- Tests must not require hardware or external services
- Use `conftest.py` fixtures for the test client

---

## API Design Principles

- All endpoints return JSON
- Errors return `{"error": "description", "detail": "..."}` with appropriate HTTP status
- All endpoints have OpenAPI docstrings (FastAPI auto-generates docs at /docs)
- Input validation via Pydantic models — never trust raw request data
- Async everywhere (`async def`) — this matters for WebSocket phase later

---

## When You're Stuck on liblouis

```bash
# Test liblouis install
python3 -c "import louis; print('liblouis version:', louis.version())"

# Translate a word
python3 -c "import louis; print(louis.translateString(['en-us-g1.ctb'], 'hello'))"

# List all tables
python3 -c "import louis; [print(t) for t in louis.listTables()]"

# Check if Nemeth table exists
python3 -c "import louis; print('nemeth.ctb' in louis.listTables())"
```

---

## Notes for Future Claude Code Sessions

- The SimulatorHAL in `hal/__init__.py` is a STUB — Aniket implements the real `CamMotorHAL`.
- pix2tex is heavy (torch). It is pinned in `requirements.txt` but **excluded from CI**
  (tests mock it; `ocr_service.py` guards the import). The Pi never runs it — see
  `requirements_pi.txt`. OCR runs on the laptop only.
- WebSocket classroom lives in `backend/routers/classroom.py`; live assessment over the
  same channel is wired there too (Phase 4). SessionManager state is in-memory (no Redis).
- SQLite models are in `backend/models/database.py` (Book, TranslationJob, ClassroomSession,
  AssessmentQuestion, StudentKnowledge). Tests override `get_session` with in-memory SQLite.
- No authentication yet — a token plan is documented in `docs/api-contract.md` for Phase 4+.
- `.sh`/`.service` files are forced to LF via `.gitattributes` (CRLF breaks bash on the Pi).
- Backend is feature-complete. New work is integration (frontend/hardware) and validation,
  not new backend features. Keep all 511 tests green; the merge gate is Aniket.

# Braillix Autonomous Session Log — 2026-05-30

**Branch:** `backend/phase0-pr`  
**Final test count:** 326 passed / 0 failed (Windows + WSL)  
**Commits this session:** 5

---

## Tasks Completed

| Task | Status | Notes |
|------|--------|-------|
| TASK 1: Fix Nemeth | ✅ | nemeth.ctb wrapper in scripts/, absolute-path API, 7 Nemeth tests now pass |
| TASK 2: Research memos | ✅ | 3 memos in docs/ — Nemeth gotchas, OCR failure modes, latency budget |
| TASK 3: GitHub Actions CI | ✅ | .github/workflows/ci.yml — Ubuntu, apt liblouis, full pytest |
| TASK 4: WebSocket classroom | ✅ | SessionManager + WS endpoints + 24 unit tests + ws_test.py smoke |
| TASK 5: SQLite DB layer | ✅ | SQLModel tables: Book, TranslationJob, ClassroomSession + 10 DB tests |
| TASK 6: Final push | ✅ | Pushed to SHV27 + Atishay9828 remotes |

---

## Test Count Progression

| Checkpoint | Passed | Failed | Skipped |
|-----------|--------|--------|---------|
| Session start | 285 | 0 | 7 (Nemeth) |
| After Task 1 (Nemeth) | 292 | 0 | 0 |
| After Task 4 (WebSocket) | 316 | 0 | 0 |
| **Session end** | **326** | **0** | **0** |

---

## Key Technical Decisions

**Nemeth fix:** `nemeth.ctb` was removed from liblouis 3.x. We created a
wrapper (`scripts/nemeth.ctb`) that includes `en-us-mathtext.ctb`. The
translator uses absolute paths to both the display table (`unicode.dis`)
and nemeth.ctb — this avoids `LOUIS_TABLEPATH` manipulation which doesn't
work after `import louis` has indexed tables.

**WebSocket architecture:** In-memory `SessionManager` singleton — no Redis
needed for 5–10 device demo scale. Teacher WS translates on the server
and broadcasts `dot_patterns` directly; students are thin receivers only.

**SQLite:** SQLModel (SQLAlchemy + Pydantic) for models. In-memory SQLite
for all tests — zero file I/O, perfectly isolated.

---

## What's Left for Next Session (Phase 2)

1. **pix2tex OCR pipeline** (`backend/services/ocr_pipeline.py`)
   - `ocr_image(image_bytes: bytes) → str` (returns LaTeX)
   - POST /ocr-image endpoint (currently placeholder)
   - Heavy install (~2 GB model) — install separately, do not block CI

2. **Classroom REST persistence** — log sessions to ClassroomSession table

3. **Book upload flow** — POST /books → store PDF → enqueue TranslationJob per page

4. **Confidence threshold** — detect low-confidence OCR output and flag it

5. **Pi firmware integration** — Aniket's CamMotorHAL replaces SimulatorHAL

---

## Blockers / Notes

- `en-us-g2.ctb` not in Ubuntu liblouis-data — Grade 2 health check returns False
  (not a blocker; Grade 1 is sufficient for demo; investigate in Phase 2)
- CI workflow installs system python3-louis (pip can't install python-louis on Linux)
- `datetime.utcnow()` deprecation warnings from SQLModel — not breaking, fix in Phase 2

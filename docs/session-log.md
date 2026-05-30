# Braillix Autonomous Session Log — 2026-05-31 (Phase 3: Adaptive Assessment)

**Branch:** `backend/phase0-pr` (fast-forwarded onto `team/main` after PRs #1–3 merged)
**Final test count:** 494 passed / 0 failed / 0 skipped
**Test progression:** 400 (Phase 2) → 402 (OCR benchmark) → 483 (assessment) → 494 (PDF pipeline)

---

## What was built

| Task | File(s) | Key decision |
|------|---------|--------------|
| 0 Git hygiene | `.github/workflows/ci.yml` | Branch was already merged to team/main via PRs #1–3 → fast-forward (no rebase needed); bumped checkout/upload-artifact v4→v5 (Node 20 EOL) |
| 1 OCR benchmark | `scripts/ocr_benchmark.py`, `scripts/generate_benchmark_images.py`, `docs/ocr-benchmark-results.md` | Ran REAL pix2tex on 20 ground-truth renders; tuned confidence with measured "exotic command" flag |
| 2 PDF pipeline | `backend/services/pdf_processor.py`, `backend/routers/ocr.py` | `extract_pages()` routes each page text/OCR/none; per-page schema, backward-compatible combined fields |
| 3 Assessment | `backend/services/{knowledge_tracer,mcq_generator}.py`, `backend/routers/assessment.py` | **The novel ML contribution.** Pure-Python online BKT + rule-based error-pattern distractors; SQLite-backed; choices Braille-encoded |
| 4 API contract | `docs/api-contract.md` | Complete request/response/error spec + WS protocol for Harshita |
| 5 Demo | `scripts/demo_full.py`, `docs/demo-script.md` | 3-scene in-process runner (`--mock-ocr`/`--simulator`), fresh student id per run, spoken narrative |
| 6 Regression | `requirements.txt`, `docs/session-log.md` | BKT/MCQ added **no new runtime deps** (pure stdlib); matplotlib is script-only, CI-excluded |

---

## Research findings (web + measured)

- **OCR benchmark (measured, not estimated):** pix2tex scores **20% strict / 85%
  lenient** exact match on 20 clean renders, mean similarity 0.80, ~1.7 s/img CPU.
  Errors are mostly cosmetic (`x`→`X`, redundant braces); **radicals hallucinate**
  worst. Confidence heuristic now flags out-of-distribution commands (`\cal`,
  `\lambda`...) that signal plausible-but-wrong reads. → `docs/ocr-benchmark-results.md`.
- **BKT:** standard 4-parameter model (L0/T/G/S); best practice G<0.3, S<0.1 (our
  defaults comply). Chose a **from-scratch online implementation** over pyBKT —
  pyBKT is for *offline parameter fitting* from log data, which we don't do; we use
  fixed research params + online posterior updates. BKT formula verified numerically
  in a unit test (linear, 1 correct → p_knows 0.30→0.689, hand-checked).
- **MCQ distractors:** literature (arxiv 2404.02124, 2406.19356) confirms rule-based
  distractors that encode *specific misconceptions* are valid and error-consistent for
  templated school math, and that LLMs are weaker at anticipating real student errors.
  Our distractors map to named errors (sign_error, dropped_term, add_across, one_root…).

---

## Smoke test output — `python scripts/demo_full.py --all --mock-ocr`

```
SCENE 1: Live Text/Math Translation
  Input LaTeX: x^2 + 3x + 2 = 0
  Nemeth Braille: ⠭⠼⠃  ⠼⠉⠭  ⠼⠃  ⠼⠚   (16 cells)
  Cam angles: [253.1deg, 337.5deg, 16.9deg, 0.0deg, 0.0deg, ...]

SCENE 2: Photo Upload -> OCR -> Braille
  OCR extracted:  x^2 + 3x + 2 = 0 (confidence 0.84)
  Pipeline: preprocess=74ms | ocr=12ms | translate=2ms | total=120ms

SCENE 3: Adaptive Assessment
  Question: What are the roots of x^2 + 3x + 2 = 0?  [skill=quadratic, difficulty=0.6]
    A) x = -2 and x = -1   B) x = -1 and x = 0   C) x = -1   D) x = 1 and x = 2
  Student selects: A (correct)
  Knowledge update: p_knows(quadratic): 0.10 -> 0.37
  Recommendation: Building quadratic skills — keep going.
```

---

## Shaurya's next actions

1. **Validate real OCR on a real photo:** `python scripts/demo_full.py --all`
   (real pix2tex) and point `scripts/ocr_benchmark.py` at an actual NCERT textbook
   scan — synthetic renders are an upper bound; real fonts will differ.
2. **Send `docs/api-contract.md` to Harshita** — she can start the frontend now.
3. **Show `knowledge_tracer.py` + the BKT unit test to Dr. Sumit Sharma** — this is
   the defensible ML angle (explainable, no black box).
4. **Tune BKT params / MCQ difficulty** once you have a little real student data.
5. **Schedule a session with a VI student/teacher** (Patiala/Chandigarh blind school)
   — user testing is irreplaceable.

## Phase 4 backlog

- Frontend (Harshita): upload portal, teacher console, assessment UI.
- CamMotorHAL (Aniket): real GPIO behind the same HAL contract.
- Stretch (not built this session): wire assessment into the WebSocket classroom so a
  broadcast auto-generates a class question; `/assessment/session/{code}` dashboard.
- Report: architecture, ML section (BKT), OCR limitations, user-testing results.

---
---

# Braillix Autonomous Session Log — 2026-05-31 (Phase 2: Image OCR)

**Branch:** `backend/phase0-pr`
**Final test count:** 400 passed / 0 failed / 0 skipped (Windows, real liblouis shim)
**Test progression:** 326 (Phase 1) → 351 (preprocessor) → 400 (OCR service + endpoints)

---

## Tasks Completed

| Task | File(s) | Key decision |
|------|---------|--------------|
| Env audit + research | `docs/env-audit-phase2.md` | pix2tex 0.1.4, torch 2.6.0, CPU mode; no opencv (PIL only) |
| Test images | `scripts/generate_test_images.py`, `datasets/test_images/` | 7 synthetic equations, incl. 72-DPI low-quality case |
| Image preprocessor | `backend/services/image_preprocessor.py` (+27 tests) | RGB (not grayscale), 1.5× contrast, light sharpen; no Otsu — pix2tex uses raw pixels |
| OCR service | `backend/services/ocr_service.py` (+36 tests) | Lazy model load, never raises, heuristic confidence (no native score) |
| OCR endpoints | `backend/routers/ocr.py`, `backend/models/schemas.py` (+13 tests) | `POST /ocr/image`, `POST /ocr/image-to-braille`; unreadable input → 200 success=false |
| Smoke test | `scripts/smoke_test_phase2.py` | In-process TestClient; mock mode default, `--real` for actual pix2tex |
| Requirements + CI | `requirements.txt`, `.github/workflows/ci.yml` | Heavy ML stack pinned but excluded from CI (tests mock OCR) |

---

## Research Findings (web + local verification)

- **pix2tex 0.1.4** is current and actively maintained; `pix2tex.cli.LatexOCR`
  returns a raw LaTeX **string with no confidence score** → we estimate confidence
  via heuristics (length, brace balance, garbage markers, command density).
- **Preprocessing:** pix2tex has an internal resolution-optimizing NN, so we do NOT
  aggressively upscale. Keep **RGB** (grayscale hurts the ViT encoder), enhance
  contrast 1.5×, sharpen once. **No Otsu/binary threshold** — it strips anti-aliasing
  the encoder relies on.
- **CPU inference** is 5–30s/image — acceptable for the teacher-scan demo flow, but
  unacceptable in tests, so **every OCR test mocks the model**. The model (~1.5 GB)
  is downloaded only on first real inference; it is never downloaded in CI.
- **Failure mode:** pix2tex returns `""` (not an exception) on failure → the service
  treats empty/garbage output as `success=False` rather than crashing.

---

## Smoke Test Output (mock mode)

```
[1] POST /ocr/image
  LaTeX:      x + 2 = 5
  Confidence: 0.85
  OCR time:   12.0ms
  Status:     OK success

[2] POST /ocr/image-to-braille
  LaTeX:      x + 2 = 5
  Braille:    ⠭⠀⠀⠼⠃⠀⠀⠼⠑
  Dot patterns: [45, 0, 0, 60, 3, 0, 0, 60, 17]
  Pipeline:   preprocess=1.8ms | ocr=12.0ms | translate=0.2ms | total=15.2ms
  Status:     OK success
```

---

## Key Technical Decisions (this session)

**Layer boundaries:** OCR (L4) lives in `services/ocr_service.py`; preprocessing (L4)
in `services/image_preprocessor.py`; translation (L3) in `services/translator.py`.
The `image-to-braille` route (L5) only *orchestrates* these services and times each
stage — no algorithms in the handler.

**Graceful degradation:** Both new endpoints return **HTTP 200 with `success=false`**
for unreadable images / failed OCR — an unreadable photo is a quality issue, not a
server error. Only malformed requests (empty/non-image → 400, >10 MB → 413) are 4xx.

**CI stays fast + green:** `requirements.txt` pins the real Phase 2 stack
(pix2tex/torch/timm/einops) for local reproducibility, but CI *excludes* it. Tests
mock pix2tex and `ocr_service.py` guards the import (`try/except ImportError`), so the
suite is green with or without the ML stack installed. Also fixed a latent CI bug: the
pip-install step now strips inline `# comments` from requirements before passing to pip
(pip errors on a bare `#` token).

---

## Immediate Next Actions for Shaurya

1. **Validate real OCR accuracy:** run `python scripts/smoke_test_phase2.py --real`
   (first run downloads ~1.5 GB) and, better, point it at a **real textbook photo** —
   synthetic fixtures don't reflect pix2tex's true accuracy on printed math.
2. **Tune the confidence heuristic** once you've seen real outputs — current thresholds
   in `ocr_service._estimate_confidence` are conservative guesses, not data-driven.
3. **Decide preprocessing defaults** after real-image testing (contrast factor, sharpen).

---

## Phase 3 Backlog

- Wire PDF image extraction (PyMuPDF) → OCR service for image-only/math pages.
- `POST /ocr/benchmark` — batch images → accuracy/timing report for demo prep.
- Pix2Text evaluation as a pix2tex upgrade (mixed text+math pages).

---
---

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

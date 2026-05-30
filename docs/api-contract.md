# Braillix API Contract

**Version:** 1.0 · **Base URL (dev):** `http://localhost:8000` · **Format:** JSON (UTF-8)

This is the complete contract for the Braillix backend. It is intended to let the
frontend (Harshita) and hardware client (Aniket) build against the API with no
further questions. Interactive docs are also served at `/docs` (Swagger) and
`/redoc` when the server is running.

> **Braille encoding note.** All `braille_unicode` fields use the Unicode Braille
> Patterns block (U+2800–U+283F). `dot_patterns` are integers 0–63: bit 0 = dot 1,
> bit 1 = dot 2, … bit 5 = dot 6 (matches the L2 HAL contract). `cell_count` always
> equals `len(dot_patterns)`.

---

## Authentication

**MVP: none.** All endpoints are open on the local network. Phase 4 plan: a bearer
token issued per teacher session, sent as `Authorization: Bearer <token>`; student
devices authenticate by session code only. Do not build auth assumptions into the
frontend yet — design the API client so a header can be injected later.

---

## Conventions

- All request bodies are `application/json` unless they upload a file
  (`multipart/form-data`, field name `file`).
- Errors use FastAPI's shape: `{"detail": "<message>"}` (validation errors return
  `{"detail": [ {loc, msg, type}, ... ]}` with status 422).
- "Soft failures" (an unreadable image, a low-confidence OCR) return **HTTP 200**
  with a `success: false` flag — they are content problems, not server errors.
  Only malformed requests return 4xx.

---

## 1. Service / Health

### GET /
Service metadata and endpoint index.
```json
{ "service": "Braillix API", "version": "0.1.0", "docs": "/docs",
  "health": "/health", "endpoints": { "...": "..." } }
```

### GET /health
```json
{ "status": "ok", "liblouis_available": true,
  "tables": { "grade1": true, "grade2": false, "nemeth": true },
  "version": "0.1.0" }
```
`status` is `"ok"` if any table is available, else `"degraded"`. Always 200.

---

## 2. Translation

### POST /translate
Plain text → Grade 1/2 Braille.

**Request**
```json
{ "text": "hello world", "grade": "grade1" }
```
| field | type | rules |
|-------|------|-------|
| text  | string | 1–10000 chars (trimmed); required |
| grade | string | `"grade1"` (default) or `"grade2"` |

**Response 200** (`TranslateTextResponse`)
```json
{ "input": "hello world", "grade": "grade1",
  "braille_unicode": "⠓⠑⠇⠇⠕ ⠺⠕⠗⠇⠙",
  "dot_patterns": [19, 17, 7, 7, 21, 0, 30, 21, 15, 7, 29],
  "cell_count": 11 }
```
**Errors:** 422 invalid/empty input · 503 liblouis unavailable.

### POST /translate-math
LaTeX → Nemeth Braille. `$…$` / `$$…$$` wrappers are stripped automatically.

**Request** `{ "latex": "x^2 + 3x + 2 = 0" }` — `latex` 1–5000 chars.

**Response 200** (`TranslateMathResponse`)
```json
{ "input_latex": "x^2 + 3x + 2 = 0",
  "braille_unicode": "⠭⠘⠆⠐⠬⠼⠉⠭⠐⠬⠼⠃⠐⠨⠅⠼⠴",
  "dot_patterns": [ "..." ], "cell_count": 18 }
```
**Errors:** 422 empty/invalid · 503 liblouis or `nemeth.ctb` unavailable.

### POST /translate/cam-angles
Dot patterns → cam motor angles (pure math, no liblouis). Always 200 on valid input.

**Request** `{ "dot_patterns": [0, 1, 63] }` — list of 1–100 ints, each 0–63.

**Response 200** (`CamAnglesResponse`)
```json
{ "dot_patterns": [0, 1, 63],
  "angles_degrees": [0.0, 5.625, 354.375], "cell_count": 3 }
```
Mapping: `angle = pattern * (360 / 64) = pattern * 5.625°`.
**Errors:** 422 any pattern outside 0–63 or empty list.

---

## 3. OCR

### POST /ocr/image
Image of a math equation → LaTeX. `multipart/form-data`, field `file`
(png/jpg/gif/bmp/tiff/webp, ≤10 MB).

**Response 200** (`OCRImageResponse`)
```json
{ "filename": "eq.png", "latex": "x + 2 = 5", "confidence": 0.85,
  "preprocessing_applied": true, "inference_time_ms": 1734.0,
  "success": true, "error": null }
```
`success` reflects `confidence ≥ 0.3` and non-empty LaTeX. An unreadable image
returns **200** with `success: false` and an `error` string.
**Errors:** 400 empty/non-image · 413 over 10 MB.

> **Accuracy expectation (measured):** ~85% lenient match on clean printed math,
> ~1.7 s/image on CPU. See `docs/ocr-benchmark-results.md`. Always show the user
> the `confidence`; route low-confidence results to a teacher for verification.

### POST /ocr/image-to-braille
The demo endpoint: image → LaTeX → Nemeth Braille, with per-stage timing.
`multipart/form-data`, field `file`. Optional query `?grade=1`.

**Response 200** (`ImageToBrailleResponse`)
```json
{ "filename": "eq.png", "latex": "x + 2 = 5",
  "braille_unicode": "⠭⠐⠬⠼⠃⠐⠨⠅⠼⠑",
  "dot_patterns": [ "..." ], "cell_count": 9, "ocr_confidence": 0.85,
  "total_time_ms": 1750.2,
  "pipeline_stages": { "preprocessing_ms": 1.8, "ocr_ms": 1734.0, "translation_ms": 0.2 },
  "success": true, "error": null }
```
On an unreadable image or failed OCR/translation: **200** with `success: false`,
`braille_unicode: ""`, `dot_patterns: []`, and an `error` string.
**Errors:** 400 empty/non-image · 413 over 10 MB.

### POST /ocr/process-pdf
PDF → Braille, **page by page**. Text pages use the text layer (Grade 1); image-only
math pages are OCR'd (Nemeth). `multipart/form-data`, field `file` (`.pdf`).

**Response 200** (`PDFProcessResponse`)
```json
{ "filename": "worksheet.pdf", "page_count": 3,
  "pages": [
    { "page_number": 1, "extraction_method": "text",
      "raw_text": "Exercise 1 ...", "latex_expressions": [],
      "braille_unicode": "⠠⠑...", "dot_patterns": ["..."], "confidence": null },
    { "page_number": 2, "extraction_method": "ocr",
      "raw_text": null, "latex_expressions": ["x^2 + 1 = 0"],
      "braille_unicode": "⠭⠘⠆...", "dot_patterns": ["..."], "confidence": 0.8 },
    { "page_number": 3, "extraction_method": "none",
      "raw_text": null, "latex_expressions": [],
      "braille_unicode": "", "dot_patterns": [], "confidence": null }
  ],
  "braille_unicode": "⠠⠑...\n⠭⠘⠆...", "dot_patterns": ["..."], "cell_count": 42,
  "combined_braille": "⠠⠑...\n⠭⠘⠆...", "combined_dot_patterns": ["..."],
  "processing_time_ms": 1900.5, "text_pages": 1, "ocr_pages": 1, "empty_pages": 1 }
```
`extraction_method` is `"text" | "ocr" | "none"`. `braille_unicode`/`dot_patterns`
/`cell_count` are the **combined** output across pages (same as `combined_*`),
retained for backward compatibility.
**Errors:** 400 empty/non-pdf · 422 corrupt/unreadable PDF · 503 liblouis unavailable.

---

## 4. Classroom (real-time)

### POST /classroom/sessions
Create a session. No body.
```json
{ "code": "AB3X9K", "teacher_url": "/classroom/teacher/AB3X9K",
  "student_url": "/classroom/student/AB3X9K" }
```
Codes are 6 uppercase-alphanumeric characters.

### GET /classroom/sessions/{code}
```json
{ "code": "AB3X9K", "created_at": "2026-05-31T10:00:00",
  "teacher_connected": true, "student_count": 3, "last_pattern": [19, 17] }
```
**Errors:** 404 unknown code.

### DELETE /classroom/sessions/{code}
`{ "deleted": "AB3X9K" }` · 404 if unknown.

### WS /classroom/teacher/{code}  (WebSocket)
Connect after creating the session (closes with code 4004 if the session doesn't exist).

**Send** one of:
```json
{ "text": "hello", "grade": "grade1" }
{ "latex": "x^2 + 3x + 2 = 0" }
```
**Receive** (echo to teacher after broadcast):
```json
{ "event": "sent", "dot_patterns": ["..."], "cell_count": 18, "students_reached": 3 }
```
On bad input: `{ "error": "send {text:...} or {latex:...}" }` (connection stays open).

### WS /classroom/student/{code}  (WebSocket)
Receive-only. Closes with 4004 if the session doesn't exist.
- On connect (late-join sync): `{ "event": "sync", "dot_patterns": [ ... ] }`
  (only if a pattern has been broadcast already), **and** the current MCQ if one is
  active: `{ "type": "assessment_question", ... }` (see below).
- On each teacher broadcast: `{ "event": "pattern", "dot_patterns": [ ... ] }`.

> **Message discrimination.** Braille messages use the `"event"` key
> (`pattern`/`sync`); assessment messages use the `"type"` key
> (`assessment_question`/`class_performance`). A client switches on whichever key
> is present. (The keys differ for backward compatibility with the Phase 3 protocol.)

### Phase 4 — connected classroom + live assessment

#### POST /classroom/sessions/{code}/broadcast-math
Translate `latex` → Nemeth, broadcast it as Braille to all students, and
(optionally) generate + broadcast one MCQ about it.

**Request** `{ "latex": "x^2 + 3x + 2 = 0", "generate_assessment": true }`

**Response 200**
```json
{ "braille_broadcast": true, "assessment_generated": true,
  "question_id": "uuid-or-null", "student_count": 2 }
```
**Errors:** 404 unknown session · 503 liblouis unavailable · 422 bad LaTeX.

Students receive two messages: the Braille `{"event":"pattern",...}` and, if
`generate_assessment`, the MCQ:
```json
{ "type": "assessment_question", "question_id": "uuid",
  "question_text": "What are the roots of x^2 + 3x + 2 = 0?",
  "expression_braille": "⠭⠘⠆...",
  "choices": [ {"index":0,"text":"x = -2 and x = -1","braille":"..."}, "...3 more..." ],
  "skill": "quadratic" }
```

#### POST /classroom/sessions/{code}/submit-answer
A student answers the session's current MCQ. Updates that student's BKT and the
live class aggregates, and pushes a `class_performance` update to the teacher channel.

**Request** `{ "student_id": "alice", "question_id": "uuid", "selected_index": 0 }`
**Response 200:** identical to `POST /assessment/submit` (`AssessmentSubmitResponse`).
**Errors:** 404 unknown session / question / question not in this session ·
409 student already answered this question · 422 `selected_index` out of 0–3.

The teacher's WebSocket receives:
```json
{ "type": "class_performance", "question_id": "uuid", "skill": "quadratic",
  "total_responses": 2, "correct_responses": 1, "pct_correct": 50.0,
  "mean_p_knows": 0.22 }
```

#### GET /classroom/sessions/{code}/performance
Poll target for the teacher dashboard (~every 5s).
```json
{ "question_id": "uuid", "skill": "quadratic", "total_responses": 2,
  "correct_responses": 1, "pct_correct": 50.0, "mean_p_knows": 0.22,
  "student_breakdown": [ {"student_id":"alice","correct":true,"p_knows":0.37},
                         {"student_id":"bob","correct":false,"p_knows":0.07} ] }
```
**Errors:** 404 unknown session.

---

## 5. Adaptive Assessment

### POST /assessment/generate
Generate an MCQ for a math expression. The correct answer is **not** revealed here.

**Request**
```json
{ "latex": "x^2 + 3x + 2 = 0", "student_id": "demo_student", "session_id": null }
```
**Response 200** (`AssessmentGenerateResponse`)
```json
{ "question_id": "8f1c...uuid",
  "question_text": "What are the roots of x^2 + 3x + 2 = 0?",
  "question_braille": "⠠⠺⠓⠁⠞...",
  "expression": "x^2 + 3x + 2 = 0", "expression_braille": "⠭⠘⠆...",
  "choices": [
    { "index": 0, "text": "x = -2 and x = -1", "braille": "⠭⠐⠨⠅..." },
    { "index": 1, "text": "x = -1 and x = 0",  "braille": "..." },
    { "index": 2, "text": "x = 1 and x = 2",   "braille": "..." },
    { "index": 3, "text": "x = 1",             "braille": "..." }
  ],
  "difficulty": 0.6, "question_type": "solve_for_x", "skill": "quadratic" }
```
`question_type`: `solve_for_x | simplify | identify_type`. `skill` is one of
`linear, quadratic, fraction, radical, trig, default`. Always 4 choices.
Distractors encode named misconceptions (not random numbers).

### POST /assessment/submit
Grade an answer and update the student model (Bayesian Knowledge Tracing).

**Request**
```json
{ "question_id": "8f1c...uuid", "student_id": "demo_student", "selected_index": 0 }
```
**Response 200** (`AssessmentSubmitResponse`)
```json
{ "correct": true, "correct_index": 0, "correct_answer_text": "x = -2 and x = -1",
  "explanation": "Correct! The answer is x = -2 and x = -1.",
  "p_knows_before": 0.10, "p_knows_after": 0.27, "skill": "quadratic",
  "next_recommended_difficulty": 0.27,
  "recommendation": "Keep practicing quadratic basics." }
```
On a wrong answer, `explanation` names the likely misconception, e.g.
`"You chose 4/6. The correct answer is 5/4. Common error: numerators and
denominators were added directly (a/b + c/d is NOT (a+c)/(b+d))."`
**Errors:** 404 unknown `question_id` · 409 question already answered ·
422 `selected_index` out of 0–3.

### GET /assessment/student/{student_id}
```json
{ "student_id": "demo_student",
  "skills": { "quadratic": { "p_knows": 0.27, "attempts": 1, "correct": 1 } },
  "overall_mastery": 0.27, "total_questions": 1, "total_correct": 1 }
```
Unknown students return 200 with empty `skills` and zeroed totals.

---

## Error Codes (summary)

| Code | Meaning | Where |
|------|---------|-------|
| 400 | Empty upload or wrong file type | OCR / PDF endpoints |
| 404 | Unknown session / question id | classroom, assessment |
| 409 | Question already answered | /assessment/submit |
| 413 | Image larger than 10 MB | /ocr/image, /ocr/image-to-braille |
| 422 | Validation error / corrupt PDF / Nemeth input error | most endpoints |
| 503 | liblouis (or nemeth.ctb) unavailable on the server | translation, PDF |
| 4004 | (WS close code) session does not exist | classroom WebSockets |

## Rate Limits

None in the MVP. Phase 4 plan: per-IP throttle on the OCR endpoints (CPU-bound,
~1.7 s/request) to protect a single-laptop teacher server.

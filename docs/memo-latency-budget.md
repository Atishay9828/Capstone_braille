# Memo: Braillix End-to-End Latency Budget

**Author:** Shaurya Verma  
**Date:** 2026-05-30  
**Target:** < 1 000 ms from text input to motor start (OCR-free path)

---

## Layer-by-Layer Budget

| Layer | Operation | Estimated Time | Notes |
|-------|-----------|---------------|-------|
| L6 Frontend | User types / uploads | 0 ms | User action |
| WebSocket send | Browser → FastAPI server | 5–20 ms | LAN; negligible |
| L4 OCR (pix2tex) | Image → LaTeX | 2 000–6 000 ms | GPU: 2s; CPU: 6s |
| L4 PDF extraction | pdfplumber parse | 100–500 ms | Per-page cost |
| L3 Translation | liblouis → dot patterns | 1–50 ms | Pure Python, negligible |
| L5 API routing | FastAPI request cycle | 1–5 ms | Async overhead |
| WebSocket broadcast | Server → Pi clients | 5–20 ms | LAN; negligible |
| L2 HAL | Pattern queued to motor | 1–5 ms | In-memory |
| L1 Motor | Cam disc rotation | 400–800 ms | Stepper, speed-limited |

### Text-Input Path (no OCR)
```
User types → WS send → translate → WS broadcast → motor
   0ms          10ms      10ms          10ms        600ms
   
Total: ~630 ms  ✅  well under 1 000 ms budget
```

### Image-Input Path (with OCR on server)
```
Camera → upload → pix2tex OCR → translate → WS broadcast → motor
  0ms     50ms     2000–6000ms    10ms          10ms         600ms
  
Total: ~2 700–6 700 ms  ❌  exceeds budget
```

### Image-Input Path (OCR on client/phone, LaTeX sent to server)
```
Camera → local OCR → WS send (LaTeX) → translate → WS broadcast → motor
  0ms    2000–4000ms     10ms             10ms          10ms         600ms
  
Total: ~2 630–4 630 ms (motor starts at LaTeX arrival: ~630 ms after server receives)
```

---

## Bottleneck Analysis

**The bottleneck is OCR, not translation.** liblouis translation takes < 50 ms
even for multi-page documents. The motor rotation (400–800 ms) is hardware-limited
and cannot be optimised in software.

For the demo use case (teacher types LaTeX directly → student device updates):
- Round-trip from keypress to motor start: **< 700 ms**  ✅
- This is fast enough to feel interactive

For the OCR use case (teacher photographs textbook):
- Total latency: 3–7 seconds
- Acceptable for a "scan and display" workflow (not interactive)

---

## Recommendation

**Run OCR server-side on the teacher's laptop, not on the Raspberry Pi.**

The Pi 4B has ~4–8× slower CPU than a modern laptop. Running pix2tex on the Pi
would increase OCR latency to 15–30 seconds — completely unacceptable.

Architecture decision: The teacher laptop runs the full FastAPI stack including
pix2tex. The Pi devices are thin clients that only receive dot patterns over
WebSocket and drive the motor. This keeps the Pi's role simple and the latency
under control.

**WebSocket path for Phase 3 classroom:**
- Teacher connects as `ws://server/classroom/teacher/{code}` and sends LaTeX
- Students connect as `ws://server/classroom/student/{code}` and receive patterns
- Server-to-student latency: < 30 ms on LAN

This architecture meets the < 1 000 ms target for the text-input path with
comfortable margin.

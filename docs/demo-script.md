# Braillix Demo Script — v1.0

**Duration:** ~4 minutes · **Presenter:** Shaurya (rotate per milestone) ·
**Driver:** `python scripts/demo_full.py --all` (add `--mock-ocr` if CPU is slow,
`--simulator` if no hardware is on the table)

> One-line pitch to open with: *"Braillix lets a student who cannot see read
> mathematics — from a textbook photo, in real time, and it adapts to how well
> they understand it."*

---

## Opening (30 seconds)

**[Say]** "A visually-impaired student in a normal math class can't follow the
whiteboard. Braille math exists — it's called Nemeth — but there's no affordable
device that shows it and no system that *teaches* with it. We built one for about
₹3000. Let me show you three things it does."

**[Do]** Have the terminal ready. Run `python scripts/demo_full.py --all` (or
`--mock-ocr`). Talk over the first scene as it prints.

---

## Scene 1 — Live Translation (60 seconds)

**[Say]** "First, the teacher just types an equation. Here, x-squared plus three-x
plus two equals zero."

**[Point out]**
- The **Nemeth Braille** line — "this is the actual math notation a blind student
  reads with their fingers, not a description of it."
- The **dot patterns** — "these are the 6-dot cells, 0–63, that drive the hardware."
- The **cam angles** — "and these are the motor angles. One stepper motor and a
  64-position cam disc raise the pins — that's the cost breakthrough versus six
  solenoids per cell."
- (If `--simulator`) the SimulatorHAL line — "the software is already talking to the
  hardware abstraction layer; Aniket's motor driver drops in behind it."

**[Say]** "Translation took about 2 milliseconds. This is the easy part — text in,
Braille out. The interesting parts are next."

---

## Scene 2 — Photo OCR (90 seconds)

**[Say]** "Real students learn from physical textbooks. So the teacher takes a photo
of the page. The system reads the math out of the image and turns it into Braille."

**[Point out]**
- The **OCR'd LaTeX** and its **confidence** — "we read the equation back out of the
  pixels with a local AI model — pix2tex — no cloud, no paid API."
- The **same Braille** as Scene 1 — "and notice it produced the same Braille, so the
  whole pipeline is consistent end to end."
- The **pipeline timing** — "preprocessing, OCR, translation, each measured."

**[Be honest — this is a strength, not a weakness]** "OCR isn't perfect — we measured
it: about 85% of clean equations come back correct, and it's weakest on square roots.
That's *why* we surface a confidence score on every read — a low-confidence result is
flagged so the teacher can step in. The system fails loudly, never silently."

**[Note]** If running `--mock-ocr`, say "I'm running the OCR step in fast mode for the
demo; the real model takes a couple of seconds per image on a laptop CPU."

---

## Scene 3 — Adaptive Assessment (90 seconds)

**[Say]** "But reading math is only half of it. Braillix also *teaches*. It generates
a practice question and adapts to the student's level."

**[Point out]**
- The **four choices, each in Braille** — "the student reads the options on the
  display and picks one with a button."
- That the **wrong answers are specific mistakes** — "these distractors aren't random.
  Option B is the answer you'd get from a sign error; option C is forgetting the
  second root. Each one maps to a real misconception."
- The **knowledge update** — "when the student answers, a Bayesian Knowledge Tracing
  model updates its estimate of how well they know quadratics — here it moved from
  0.10 to 0.37 — and recommends the next question's difficulty."

**[Say]** "That's the part that makes this a tutor, not just a display. The system
learns the student, and gives them the next problem at the right level."

---

## Closing (30 seconds)

**[If hardware is on the table]** "Everything you saw drives this device through one
clean interface. The same dot patterns light up these physical cells."

**[If hardware is not on the table]** "The hardware is a single-motor cam mechanism
our team built; the software you just saw drives it through a hardware abstraction
layer, so the device and the backend developed independently and meet at one contract."

**[Say — the closing line]** "A teacher photographs a worksheet, and a student who
can't see reads the equation with their fingers and gets a question pitched to exactly
what they're ready for. That's Braillix."

---

## Failure-recovery cheatsheet (for the presenter)

| If… | Do this |
|-----|---------|
| OCR is slow / hangs | re-run with `--mock-ocr`; say "running OCR in fast mode" |
| liblouis/Braille shows empty | `--mock-ocr` still shows Scenes 1 & 3; note "translation service is the dependency" |
| Hardware not responding | drop the device from the story; run `--simulator` to show the HAL output instead |
| A scene errors | run just the good scenes: `--scene 1`, `--scene 3` |
| Numbers look "already advanced" | each run uses a fresh student id, so mastery always starts at the prior — re-run cleanly |

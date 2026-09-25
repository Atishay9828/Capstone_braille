# Braillix — Project Report Source Document

Prepared 22 August 2026 from the codebase as deployed at https://braillix.vercel.app
(repository: github.com/SHV27/braillix, branch `main`). All numbers in this document were
measured on that build, on real hardware or in a real browser, on the dates given. Written
for the report author; no marketing language.

Team: Shaurya Verma (Software), Harshita (Software), Aniket (Software), Atishay (Hardware),
Mridul (Hardware).

## 1. Problem statement

Blind students in India largely stop studying mathematics between classes 7 and 8. The
proximate causes are documented: mathematics teaching in schools for the blind relies on the
Taylor frame and the abacus; braille textbooks are shared rather than individual; digital
mathematics content is the least screen-reader-accessible subject area; and refreshable
braille displays that could help are either imported and expensive (₹1.5 lakh and above for a
40-cell line) or not designed for mathematics teaching at all. No commercially available
device addresses the classroom act itself: a teacher working through a problem on a
blackboard, line by line, while the class follows.

Braillix addresses that act. The teacher writes, types, or photographs whatever she is
teaching at that moment — full worded questions, equations, worked steps — and each line is
rendered as mathematical braille on a refreshable display the student reads by touch. The
software is designed for a teacher whose technology experience is WhatsApp, YouTube and
Facebook, and it requires no account, no server, no API key and no network after first load.

The project is split in two: a hardware team building the display (an ESP32 "brain pod"
driving motorised "muscle cells", one braille character per cell), and this repository — the
complete software half, which is fully functional with no hardware attached.

## 2. What the product does

The interface is a single surface designed to read as a blackboard: the lesson stands on it
as typeset print, the braille cells sit beneath it, and one input tray (with every school
mathematics symbol permanently visible) is the only place anything is written. Device
configuration and help are behind two doors in the top rail. This is a deliberate v4
redesign: usability testing with the project owner showed that capability which must be
found behaves identically to capability which is absent.

- **The board.** The teacher types a line in ordinary notation (`2x + 3 = 11`, `sqrt(144)`,
  `1/2`, or Hindi text such as `दो संख्याओं का योग 12 है`) and presses Enter. The line joins
  the lesson — a stack of lines, like a blackboard — is translated to braille, sent to the
  display, and spoken aloud. Any earlier line returns to the display with one press. Lessons
  persist across restarts on the same laptop.
- **Handwriting, in place.** Pressing the pencil turns the board's next empty line into a
  writing surface. The teacher writes a step with a finger, stylus or mouse; when the hand
  pauses (1.2 s), the strokes are rasterised to a clean black-on-white image and read by the
  same on-device recogniser the camera path uses (the model was trained on handwritten as
  well as printed formulas — UniMER-1M, handwritten-subset BLEU 0.86). The reading lands in
  the input box behind the print preview and the braille verdict; the teacher's ordinary
  "put on the board" press is the confirmation. If she edits the box by hand, the strip
  never overwrites her text. The committed line keeps her strokes as a faint ghost behind
  the typeset print.
- **Scanning.** Photograph paths, all processed on the laptop with no network: an equation
  photo, and a full textbook question scanned part by part — the teacher drags a box around
  the sentence, then around the mathematics, tags each, watches each be read, corrects
  anything doubtful, and only then sends the assembled line to the board. Keyboard-only
  paths exist for all of it.
- **The confirm gate.** No recognised content can reach the display without explicit teacher
  approval. This is enforced in the type system (a "recognised" lesson line cannot be
  constructed without a literal `confirmed: true`), not by interface convention.
- **Reading.** The pod's own Prev/Select/Next buttons, the on-screen arrows, and
  PageUp/PageDown all drive one pager that walks the lesson continuously: through the panes
  of a long line, then onward to the next line; paging backwards enters a line at its last
  pane. On a one-cell display this makes a whole worked example readable in order. A
  structure-exploration mode folds long expressions into navigable sub-expressions.
- **Verification shown to the teacher.** Every line's braille is read back by independent
  engines that never saw the input (one per braille code on the line) and the agreement or
  disagreement is displayed. Where translation cannot be vouched for, the interface says so;
  it never silently substitutes.
- **Languages.** The full interface, speech, and braille pipeline work in English and Hindi.

Deliberately excluded (by the founder's direction): worksheets, lesson libraries, practice
drills, student records, and any language beyond English and Hindi.

## 3. Technology stack and why each piece

| Layer | Choice | Reason |
|---|---|---|
| Application | Vite 8, React 19, TypeScript 5.9, Zustand 5 | Standard, minimal, static-deployable; one store as the single authority for display state |
| Maths input | Custom natural-notation parser + LaTeX passthrough (`core/mathinput.ts`) | Teachers write `1/2`, not `\frac{1}{2}`; both are accepted by one entry point |
| LaTeX → MathML | temml 0.13 | Small, fast, no server |
| MathML → Nemeth braille + speech | speech-rule-engine 4.1 (Apache-2.0) | The only maintained library that produces both Nemeth braille and MathSpeak-style speech from the same MathML, entirely in the browser |
| Hindi literary braille | Hand-built Bharati Braille tables (`core/bharati.ts`), verified against the NIEPVD/GoI Bharati Braille standard | liblouis's Nemeth table is explicitly unmaintained upstream; Bharati forward+reverse tables were small enough to build and test directly |
| Reverse verification | Hand-built readback engines (`core/readback.ts`, `core/bharatiback.ts`, `core/literalback.ts`) | Independent reconstruction of meaning from dots is the only proof that does not share code (and therefore bugs) with the forward translation |
| Formula recognition | Vision encoder–decoder ONNX model ("formulanet", ~76 MB fp32), run by @huggingface/transformers 4.2 on ONNX Runtime WASM, in a Web Worker | Free, runs offline on modest laptops, reads printed and handwritten mathematics; nothing a student writes leaves the machine |
| Word recognition | tesseract.js 7 (Apache-2.0) with tessdata_fast English + Hindi, fully self-hosted | The words of a textbook question, both scripts, offline |
| Speech output | Web Speech API, voices from the operating system | Free and offline; absence of a voice is reported, never silent |
| Hardware link | Custom `Transport` interface with three implementations: simulator, Web Serial (USB), HTTP (Wi-Fi pods) | One interface means the app cannot behave differently on hardware than in the simulator |
| Testing | Vitest 4 (727 unit tests), Playwright 1.62 (101 end-to-end journeys with screenshots at 390/834/1440 px) | See §7 |
| Deployment | Vercel, static, free tier | No server component exists |

Everything is served from the application's own origin — fonts, braille tables, both
recognition engines and their models. After the first visit a service worker keeps the
application fully functional offline; large model files are cached on first use.

## 4. System architecture and data flow

```
teacher input (type | handwriting on the board | photo | textbook scan)
    → [scan paths only] recognition workers (formula ONNX · tesseract eng+hin)
    → [scan paths only] CONFIRM GATE — teacher sees print + hears speech, approves
    → lesson store (lines of segments: English text | Hindi text | mathematics)
    → translation core: natural notation → LaTeX → MathML → Nemeth cells
                        Hindi words → Bharati cells · English words → Grade-1 cells
    → independent readback (per braille code) → agreement shown to the teacher
    → pager (lesson lines → display-sized panes → cells, sized by the discovered profile)
    → transport (simulator | USB | Wi-Fi pods) → cam positions 0–63 → motors
    ↘ speech (line spoken as it lands)   ↘ on-screen dot rendering (always)
```

Principles enforced structurally rather than by convention:

- **One authority per fact.** The Zustand store owns the display state; a single selector
  derives every frame. The cell count exists nowhere in code — it is discovered from the
  transport (an I2C scan reported by the pod, or the simulator's setting).
- **Observable degradation.** Every optional capability (recognition, speech, USB, pod,
  offline copy) publishes state · reason · fix, rendered as badges and checked by a
  one-button self-test on the Help screen.
- **The previous frame is sacred.** Errors freeze the display at the last good frame and say
  what went wrong; the display never blanks.
- **The build refuses to ship blind.** `app/scripts/assert-assets.mjs` fails the production
  build if any of 11 on-device assets (model weights, ONNX runtime, OCR languages, braille
  tables) is missing from the artifact, and `tools/check-deployed.mjs` asserts they are
  actually served by the live site (21 live checks).

## 5. The hardware interface

Ground truth is the hardware team's handoff document; the software implements its protocol
exactly and ships a zero-dependency emulator (`tools/virtual-pod`, plain Node) that speaks
the same wire protocol, so integration is tested continuously without hardware.

- Pipeline: braille cell (dots 1–6) → 6-bit cam number 0–63 (dot 1 = bit 0) → HTTP to the
  pod → I2C to the muscle cell → stepper motor to one of 64 cam positions (4096 half-steps
  per revolution, 64 per position, hall-sensor homing).
- Protocol: `GET /chain` (I2C scan → cell count and addresses 0x20–0x27), `POST /show`
  (cam positions, full or delta), `POST /layout` (multi-pod slicing so several pods carry
  one message), `GET /buttons` (Prev/Select/Next), `POST /home`.
- The cell count is discovered at connection, never assumed; multiple pods negotiate a
  common layout; a mirror mode shows the same content on every pod for a classroom.
- Physical uncertainties the handoff flags (cam bit order, cell direction, home position)
  are runtime configuration with a ten-second calibration screen (raise one dot on every
  cell), not constants — a wiring difference is fixed by a setting, not a reflash.
- Motion is planned for the shortest cam arc; the status strip reports half-steps moved and
  saved (typically 50–90 % less motor travel than naive rotation).

Verified end-to-end on 21 August 2026 against the emulator: chain discovery reported 1 cell;
the line `2x = 8` put cam 60 (⠼, the Nemeth numeric indicator) on the wire; pressing the
pod's own Next button advanced the application to cell 2 and the pod to cam 6 (digit 2).

## 6. Models used

| Model | Size | Task | Where it runs |
|---|---|---|---|
| "formulanet" vision encoder–decoder (ONNX, fp32) | 76 MB | printed and handwritten mathematics → LaTeX | Web Worker, ONNX Runtime WASM, on the user's machine |
| tessdata_fast `eng` | 2.0 MB (gzipped) | printed English words → text | tesseract.js WASM worker |
| tessdata_fast `hin` | 0.9 MB (gzipped) | printed Hindi (Devanagari) words → text | tesseract.js WASM worker |
| speech-rule-engine mathmaps (en, hi) | ~1 MB | MathML → Nemeth braille and spoken mathematics | main thread, pure JS |

Recognition design: the model's reading is never trusted. It is shown rendered in print,
with a quality judgement and its reasons; below-confidence readings are flagged "not sure —
check this"; when the model is uncertain the same image is read a second time through
different preprocessing and the two readings are compared (agreement is evidence,
disagreement is surfaced as a choice). The teacher can correct any reading in an ordinary
text field before approving it — the same motion as correcting one word of voice typing.

Both recognisers are warmed in the background at application start, with an honest progress
badge, so the teacher's first scan does not pay the load cost.

## 7. Testing and verification results (all measured 21 August 2026)

| Evidence | Result |
|---|---|
| Unit tests (Vitest) | 727 / 727 passing |
| TypeScript, ESLint | clean |
| End-to-end journeys (Playwright, real browser, production build) | 101 / 101 passing, with screenshots at 390 / 834 / 1440 px and a no-horizontal-scroll assertion per screen. Includes two handwriting journeys that draw real mouse strokes on the ink strip, wait for the on-device reading, and follow it through the confirm gate onto the board — and one that proves a hand correction is never overwritten by a later reading |
| Curriculum coverage | **232 / 232 lines across 27 topics** (NCERT arc, classes 1–12), with the senior classes at full depth after a v5 gap audit: sets/relations/functions, inverse trigonometry, permutations–combinations and the binomial theorem written as `nCr`, sequences, complex numbers, conics, calculus from limits to differential equations (including `int u dv = uv - int v du`), vectors and 3-D, matrices and determinants, conditional probability and Bayes' theorem, and a linear-programming objective. Every line is independently read back from its cells. Regenerable as `docs/ACCURACY.md`; re-runnable live from Help ("Prove the syllabus") |
| Senior-syllabus gap audit (22 Aug 2026) | 48 deep class-11/12 concept lines stress-tested: 12 initial failures in 7 classes (set words split as English, `nCr` read as a word, the conditional bar, spaced dot products, `arcsin`, the prime cell, `f: A -> B`) — all closed with parser/checker rules and folded into the tested syllabus |
| Multi-pod classroom | Two protocol-accurate virtual pods of different widths (4 and 2 cells) connected mirrored: both wires received the same frame, the wider pod's spare cells blanked, verified live with wire logs and screenshot (`docs/shots/mirror-two-pods.jpeg`). A chain-shaped validation bug rejecting unequal mirrored pods was found by this live test and fixed with regression tests |
| Golden vectors | Nemeth output asserted against dot patterns from the official BANA Nemeth 2022 code book; Bharati output against the NIEPVD/Government of India Bharati Braille standard |
| Round-trip law | Every expression's cells are read back by engines that share no code with the forward translation; disagreement is displayed, and the cosmetic LaTeX tidier is tested to never change the resulting braille |
| Recognition speed | Cold press-to-result was 64.2 s (model load dominated); after background warm-up, 1.25 s press-to-result measured even when scanning immediately after page load; steady-state 0.7–2.5 s per scan on a mid-range laptop |
| Recognition accuracy (spot, real browser) | Handwritten sample → `x^{2}+5x=6` correct; unseen stacked-fraction image → `\frac{x^{2}+1}{2}=5` correct; unseen printed sentence + equation → words 93–94 % confidence and exact, equation exact; unseen Hindi sentence → exact at 88 % confidence |
| Hardware protocol | Emulator loop verified live (see §5); a shared conformance test suite runs against all three transport implementations |
| Deployed site | `tools/check-deployed.mjs`: 21 / 21 checks — page, service worker, Nemeth tables, manifest, icons, model weights, ONNX runtime, OCR worker and both language files all served |
| Accessibility | Landmarks/headings/labels/focus asserted by automated tests on every screen; ARIA live regions on every state change; full keyboard operation including a no-drag scanning path; `prefers-reduced-motion` honoured. Not a substitute for user testing with screen-reader users, which has not been done |

## 8. Limitations (honest)

- **Recognition is not perfect and is designed around that fact.** Handwriting quality,
  page skew and low light reduce accuracy; the mitigation is the visible quality judgement,
  the second reading, and the mandatory human confirmation — not a claim of perfection.
- **Handwritten words (as opposed to mathematics) are weak.** The ink strip's "Words" mode
  routes handwriting through Tesseract, which is trained on print — careful, print-style
  writing works; cursive and handwritten Devanagari genuinely do not, and no free
  browser-runnable handwritten-Devanagari model existed as of August 2026 (researched, with
  sources, in the project decision log). Mathematics ink is the strong path; the confirm
  gate carries the rest.
- **The braille pipeline is Grade 1 plus Nemeth.** Grade 2 (contracted) literary braille is
  not implemented. The Indian mathematics braille code is treated as Nemeth-compatible; a
  symbol-level diff against the NIEPVD manual (print-only) has not been performed.
- **Nemeth is rendered linearly.** Spatial layouts (long division worked in columns,
  matrices as grids) are linearised or explored as structure, which is a genuine pedagogical
  compromise on a one-line display.
- **Single-line hardware.** Multi-line spatial reading is out of scope for both teams.
- **One real muscle cell existed at integration time.** Multi-pod behaviour is verified
  against the emulator, not against physical multi-pod hardware.
- **Screen-reader user testing has not been conducted**; accessibility is asserted
  structurally and by automated test only.
- **Speech depends on operating-system voices**; a machine without a Hindi voice speaks
  English and says so on the badge.

## 9. Future work

- Evaluate Texo (2026, AGPL, ~20 MB) as a smaller, faster formula-recognition model.
- Grade 2 contractions; symbol-level reconciliation with the NIEPVD Indian mathematics code.
- Multi-threaded ONNX inference (attempted; session initialisation hangs inside a nested
  worker under cross-origin isolation — needs investigation outside that configuration).
- Per-pod cursors so several students can read different lines of the same lesson
  simultaneously, with a "bring everyone to me" teaching action.
- Automatic page-layout detection so a full textbook page needs no manual region boxes.
- Field testing in a school for the blind, including screen-reader users and teachers.

## 10. Repository map

```
app/            the product (Vite + React + TS)
  src/core/     translation engine: input → LaTeX → MathML → Nemeth/Bharati → cells → cams
  src/recognise/ on-device recognition (formula worker, tesseract words, preprocessing)
  src/transport/ simulator | Web Serial | HTTP pods, one interface + conformance suite
  src/ui/       the blackboard surface, chalk tray, ink strip, cells strip, drawer, i18n
  src/lesson.ts the blackboard's memory: lesson lines, selection, the typed confirm gate
  src/draft.ts  the chalk in the hand: one owner of the line being written
  src/ink.ts    ghost ink: the teacher's strokes kept behind recognised lines
firmware/       ESP32 pod + muscle-cell sketches (hardware team's domain)
tools/          virtual pod emulator · model fetchers · accuracy report · deployed-site check
docs/           PROTOCOL.md (wire protocol) · ACCURACY.md (generated) · this report
```

# ARCHITECTURE — Braillix v2 ("The Blackboard")

Replaces the v1 document (git history holds it). Produced after the five attacks, 21 Aug 2026.

## System sketch

```
teacher input (type | scan | draw)
      → recognise worker (formula ONNX + tesseract.js eng+hin)   [scan/draw only]
      → CONFIRM GATE (print render + speech; teacher approves)   [scan/draw only]
      → Lesson store  (lines of segments: text-en | text-hi | math)
      → core translate (temml→MathML→SRE→Nemeth | Bharati tables) → cells (dots 1-6)
      → pager (lines → panes → cells, sized by DisplayProfile)
      → transport (sim | webserial | httppod)  → hardware cams (0-63)
      ↘ speech channel (SRE text + speechSynthesis)  ↘ on-screen dot rendering (always)
```

## The state authority

ONE Zustand store: `useBoard`. It owns the lesson (lines + their translations), the cursor
(`{lineIndex, paneIndex}`), and the mode (`follow | explore`). Every frame shown on screen, sent
to hardware, or spoken derives from `selectFrame(state)` — a single exported selector. Nothing
else computes cells for display; a second computation is a fork of its bugs (Law 5).
`DisplayProfile` (cell count, pods) has one owner: the transport layer's discovery; the store
subscribes, never assumes.

## Choke points & enforcers

- **Cells reach hardware only through `transport.send(frame)`**, which validates every cam
  0–63 and frame length === discovered cell count. Enforced at the transport boundary.
- **Recognition output reaches the lesson only through the confirm gate** — the store's
  `addLine` for recognised sources requires `confirmed: true`; the type system makes an
  unconfirmed recognised line unrepresentable.
- **Translation failures cannot blank**: `translate()` returns either verified cells or a
  `degraded: 'literal'` result with reason; the renderer shows the last good frame + badge.

## Data model (10 lines)

```
Lesson   { id, createdAt, lines: Line[] }
Line     { id, segments: Segment[], cells: Cell[], status: 'ok'|'degraded', lang: 'en'|'hi' }
Segment  { kind: 'text-en'|'text-hi'|'math', value: string }   // math value = LaTeX
Cell     { dots: number[] (1..6), meaning: string, camPos: number }
Cursor   { lineIndex: number, paneIndex: number }
Mode     'follow' | 'explore'        // explore set by student nav; Select rejoins live
DisplayProfile { cellCount, pods: {index, cells}[] }           // discovered, never literal
Capability { state: 'ready'|'degraded'|'off', reason: string, fix: string }  // per capability
Recognition draft { image, regions: {crop, kind, value, confidence, verified}[] }
```

## Failure modes & their visible notices

| Failure | Behavior | Notice |
|---|---|---|
| Formula model absent | scan tab stays usable for typing; auto-fetch with progress bar | badge: "Recognition — downloading (34/76 MB)" or one-line fix |
| Tesseract traineddata absent | math-only scan still works | badge on words region: "Word reading unavailable — reconnect once to download" |
| Low recognition confidence | region flagged, prefilled editor opens, palette fallback | "Not sure about this part — check it" (spoken too) |
| Transport lost | sim continues; hardware frame HELD (Law 4) | badge: "Display disconnected — dots frozen at last line" |
| Speech unavailable | dots + print continue | badge: "Speech off — <reason>" |
| Translation failure | literal braille fallback, flagged, never silent | line marked "shown letter-by-letter, not as maths" |
| App offline | everything works (self-hosted models/fonts) | offline badge state |

## Design laws for this project

The Seven Laws of CLAUDE.md stand unchanged. Instantiated for v2:
1. Cell count discovered (`useDisplayProfile()`), never known — pager math included.
2. Nemeth 2022 golden vectors (from the official BANA PDF) + SRE differential + readback
   round-trip = three independent proofs. Physical mappings stay runtime config.
3. Every capability publishes `{state, reason, fix}` — badges, not silence.
4. The previous frame is sacred — errors freeze, say why, never blank.
5. `useBoard` + `selectFrame` are the one authority for what the dots say.
6. Full keyboard operation, ARIA live on every state change, WCAG AA, reduced motion.
7. `npm run verify` green + real-browser screenshots, or it isn't done.

New v2 law: **The confirm gate is structural.** Recognised content is typed as unconfirmable
into the lesson without teacher approval — not a UI convention, a type constraint.

## Sync semantics (follow-the-chalk)

Default `follow`: the teacher's cursor is the display state; adding or selecting a line moves
the cells. Student Prev/Next on the pod switches to `explore` (paging panes/lines locally);
Select rejoins the live line. The teacher has one "bring everyone to me" action. New lines
during explore set a pending marker (spoken as "new line on the board") — never a forced yank.

## STACK LOCK (verified live 21 Aug 2026)

Keep the installed, verified-green toolchain — boring-technology bias under a 6–7h clock:
- Vite 8.2.1 · React 19.2.8 · TypeScript 5.9.3 · Zustand 5.0.15 · Vitest 4.1.11 ·
  Playwright 1.62.1 (all already installed, 750/750 tests green, tsc clean)
- temml 0.13.4 (LaTeX→MathML) · speech-rule-engine 4.1.4 (Nemeth + speech; SRE 5.0 is RC —
  not adopted mid-flight) · @huggingface/transformers 4.2.0 + local formulanet ONNX (76 MB,
  verified working in-browser today)
- **ADD: tesseract.js 7.0.0** (Apache-2.0; eng+hin traineddata self-hosted in public/, not CDN)
- NOT adopted: TypeScript 7 (new major, zero benefit tonight), SRE 5 RC, Texo (upgrade
  candidate only if clock allows; logged in NOTES.md)
- Deploy: static (Vercel), models included in the artifact — the v1 death is structurally
  closed by making `verify` fail if model files are absent from the build output.

## Contradictions found & resolutions

1. **Live sync vs student autonomy** → mode flag + explicit rejoin + pending marker (above).
2. **Confirm-everything vs WhatsApp-effortless** → typed input needs no modal gate (its
   always-visible print+speech rendering IS the confirmation surface); only recognised
   (scan/draw) content passes the structural gate.
3. **Bharati digits (number-sign + upper a–j) vs Nemeth dropped digits** → segment `kind`
   decides the code; the boundary indicator is emitted by the translator, never hand-managed.
4. **"Model ships with build" vs repo hygiene (76 MB in git)** → model stays out of git;
   `verify`/build pipeline fetches it into the artifact and FAILS LOUDLY if absent — absence
   becomes a build error, not a runtime surprise.
5. **Discovered cell count vs 60s no-hardware demo** → sim transport is a first-class pod
   (default 1 cell, adjustable); the profile is still discovered through the same interface.

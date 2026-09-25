# THIRD PARTY — what Braillix stands on, and under what licence

Braillix's own code is MIT. Everything below is somebody else's work, named because composing
proven work is senior engineering and pretending otherwise is not.

## Runtime dependencies (bundled)

| Project | Licence | What it does for us |
|---|---|---|
| [speech-rule-engine](https://github.com/speech-rule-engine/speech-rule-engine) 4.1.4 | Apache-2.0 | MathML to **Nemeth braille**, to spoken maths in English and Hindi, and to the semantic tree the Reader navigates. The single most important dependency in the project. |
| [Temml](https://github.com/ronkok/Temml) 0.13.4 | MIT | LaTeX to MathML, and the visual rendering for sighted users. |
| [@huggingface/transformers](https://github.com/huggingface/transformers.js) 4.2.0 | Apache-2.0 | Runs the ONNX recognition model in the browser over WebAssembly. |
| [React](https://react.dev) 19 · [Zustand](https://github.com/pmndrs/zustand) 5 · [Vite](https://vite.dev) 8 | MIT | App shell, state, build. |
| [IBM Plex Sans / Mono](https://github.com/IBM/plex) (via Fontsource) | SIL OFL 1.1 | The typeface. Self-hosted; no font CDN is ever contacted. |

## Downloaded at setup, never redistributed by us

| Asset | Licence | Note |
|---|---|---|
| [alephpi/FormulaNet](https://huggingface.co/alephpi/FormulaNet) ONNX weights (~80 MB) | **AGPL-3.0** | Handwritten/printed maths image to LaTeX. **Not committed to this repository and not distributed with it.** `npm run fetch:model` downloads it from Hugging Face onto your own machine, where you use it. Braillix's own source stays MIT; the recognition provider is an interface, so an MIT-licensed model can replace it. |

## Studied, not copied

- [giacolees/obsidian-math-convert](https://github.com/giacolees/obsidian-math-convert) (MIT) — its
  `src/inference.ts` is the reference for FormulaNet's image preprocessing (grayscale, histogram
  auto-invert, crop to ink, letterbox to 384x384, normalise with mean 0.7931 / std 0.1738). Our
  implementation is written independently against the same model contract, but the recipe is theirs
  and it is the reason our recognition works at all.

## Standards we implement

- **The Nemeth Braille Code for Mathematics and Science Notation, 2022** — Braille Authority of
  North America. The maths braille code Braillix emits.
- **Guidance for Transcription Using the Nemeth Code within UEB Contexts** — BANA. The source of
  the switch indicators Braillix writes around mathematics inside a sentence: opening ⠸⠩ (dots
  4-5-6, 1-4-6) and terminator ⠸⠱ (dots 4-5-6, 1-5-6).
- **Unicode Braille Patterns** (U+2800-U+283F) — the dot-to-bit ordering used throughout.
- **Braille ASCII** (the North American Braille ASCII character set) — the sixty-four characters a
  `.brf` file is made of, in `app/src/core/brf.ts`.
- **Standard Bharati Braille Codes** (DEPwD / NIEPVD, 4 January 2025) — the Indian standard for
  language braille, covering 13 languages across 9 scripts. Braillix implements the **Devanagari**
  letter, matra, nukta, digit and punctuation tables for the Hindi words in a maths question.
  Braillix implements it for **all nine scripts** — Devanagari, Bengali, Gurmukhi, Gujarati, Oriya,
  Tamil, Telugu, Kannada and Malayalam — through one table and the parallel layout of the Unicode
  Indic blocks, which is exactly the unification the code was created to express.
  Its **mathematics** notation has no open machine-readable table, which is why Braillix ships
  Nemeth for the maths with a documented swap point. See DECISIONS.md D2.1, D7.3 and D11.1.
- **liblouis `tables/devanagari.cti`** (LGPL-2.1-or-later) — maintained for the National Institute
  for the Visually Handicapped, Dehradun. **Not vendored**: it was read as the authority for the
  nukta letters, the halant, the anusvara/visarga/chandrabindu and the digits, and our table in
  `app/src/core/bharati.ts` is written independently from it and from the published letter charts.
  Where the two sources disagree about halant placement, the disagreement and the choice are
  recorded in the file and in DECISIONS.md D7.9.

## Typefaces

- **IBM Plex Sans** and **IBM Plex Mono** (SIL OFL 1.1) — the interface and anything numeric.
- **IBM Plex Sans Devanagari** (SIL OFL 1.1) — Hindi. A separate IBM Plex face rather than a
  subset, added so a bilingual interface is not bilingual by accident on somebody else's machine.
- **Temml.woff2** (SIL OFL 1.1, a clone of KaTeX_Script-Regular) — ships with Temml for the script
  capitals it cannot borrow from the system maths font. 9 KB, bundled, never fetched.

All self-hosted through `@fontsource`. Nothing in Braillix ever touches a font CDN.

## Hardware specification

- `docs/SOFTWARE_TEAM_README.pdf` — the Braillix hardware team's software handoff. Ground truth for
  the cam, the I2C chain, the pin map and the wire protocol.

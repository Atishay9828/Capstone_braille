# Presenting the simulator — 24 August

**Written 2026-08-15. Nine days out.**

Assumption, stated by Mridul: **you drive the demo and you do the talking.** No guided tour, no
narration overlay, no onboarding for strangers. The site is a visual aid you operate live in
front of a panel.

That changes the priorities completely. Everything in `SIMULATOR_REVIEW.md` about READMEs,
licences, accessibility and tours is **backlog** — real, but not for the 24th. What follows is
only what bites in a room with a projector.

---

## The measured problem: nobody in that room can read this page

| Font sizes declared in `index.html` | Count |
|---|---|
| ≤ 12px | **15 of 18** |
| Most body text | **10–11px** |

Body text is `--dim: #8d93b0` on `--panel: #181a2b` — about **5.3:1** contrast. Fine on your
laptop, 40cm away, in a dark room.

A projector loses roughly half its contrast under normal room lighting, and the panel sits
three to five metres back. Effective contrast lands near **2.5:1 at 10px**. They will read the
big letter glyph and **nothing else** — not the part descriptions, not the decode panel, not
the button labels.

**This is the single highest-value fix for eval day and it is pure CSS.**

---

## The five things worth building

### 1. A Present mode — one toggle

Scale the whole UI ~1.6×, raise `--dim` toward `--ink`, thicken panel borders, and drop the
panels that are not being discussed. Bind it to a key so it survives a fumbled click.

Roughly one evening. Nothing else on this list comes close in value.

### 2. Preset camera buttons — *not* a tour

The failure mode is you dragging the mouse mid-sentence hunting for the cam while the panel
watches. That reads as unprepared, and a trackpad makes it worse.

Five buttons that jump instantly, no animation narration, no script:

```
[ Overview ]  [ Cam ]  [ Linkage ]  [ Electronics ]  [ Dock ]
```

You still say every word. The buttons only stop you fishing for an angle. The camera plumbing
already exists — `__braillix.look()` was added for debugging and does exactly this.

**2–3 hours.**

### 3. Keyboard control

Reaching for five identical-looking buttons under pressure is a mistake waiting to happen.

| Key | Action |
|---|---|
| `Space` | play / pause |
| `→` | step one cell |
| `R` | reset view |
| `1`–`5` | jump to preset view |
| `X` | X-ray |

Also means you can drive it from a presenter remote if the lab has one. **30 minutes.**

### 4. A wires toggle

Right now Electronics shows boards *and* the loom together. The loom is visually busy, and
anything that reads as clutter invites a question that eats your time.

Separate them so you can show boards first, then add the wiring when you choose to talk about
it. **1 hour.**

### 5. Decide the shaft story now

**5.2mm of motor shaft stands proud of the base plate.** It is visible. Someone on that panel
will point at it.

Two acceptable answers, and you must pick one before the day:

- **Present it.** *"The simulator caught this — the shaft is 10mm, only 4.8mm fits in the cam
  hub, so either the hub grows or the shaft gets cut."* This is the strongest possible answer:
  it proves the simulator does real work rather than being a pretty picture.
- **Hide it** with a flag in the code and do not raise it.

The failure mode is neither: being surprised by it and improvising. **Pick one this week.**

---

## Zero-code items that matter more than any of the above

### Run from localhost, not GitHub Pages

The payload is **3.7 MB**, of which 2.5 MB is one GLB. On lab wifi that is a blank screen with a
spinner while a panel watches. From `run.bat` it is instant, and it works with the wifi down.

Have `run.bat` already running and the tab already open **before** you connect the projector.

### Test at the projector's real resolution

Lab projectors are frequently **1024×768, 4:3**. The UI panels are fixed to the four corners and
have only ever been checked at 16:9 and on a phone. At 4:3 they may well overlap.

Ten minutes with the actual projector removes the entire risk. If you cannot get the room, at
minimum resize your browser window to 1024×768 and look.

### Rehearse the exact click sequence

Write down the order and run it twice:

1. `Braille 101` — Step through, point out the capital sign and the number sign
2. `A1` — four cam indexes for two characters, the argument for multi-cell
3. `CAB` — Step, showing the cam reverse direction
4. X-Ray on — the linkages riding the cam
5. Electronics on — pod, driver, motor, the pogo interface
6. `HELLO WORLD` + Simulate — the whole thing running

Six moves. If you know them cold, nothing else on this page matters much.

---

## Priority, honestly

| | Item | Effort | If you only do... |
|---|---|---|---|
| 1 | Present mode (size + contrast) | 1 evening | **this one** |
| 2 | Preset camera buttons | 2–3 h | ...and this |
| 3 | Rehearse the six-step sequence | 1 h | ...and this |
| 4 | Test at 1024×768 | 10 min | |
| 5 | Keyboard shortcuts | 30 min | |
| 6 | Wires toggle | 1 h | |
| 7 | Decide the shaft answer | 0 | |

Items 1–3 are **one day total** and cover essentially all of the risk. Everything after that is
polish.

---

## Deliberately not before the 24th

- README, LICENSE, meta tags — **the panel is not browsing your repo**
- Accessibility and audio — genuinely important, entirely invisible on eval day
- Guided tour — you are the tour
- Draco compression — irrelevant when serving from localhost
- Multi-cell, hover labels, scale overlay — half-finished features read as broken

All of it stays in `SIMULATOR_REVIEW.md` for after.

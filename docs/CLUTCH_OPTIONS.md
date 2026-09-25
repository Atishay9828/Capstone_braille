# Stopping the dots from flickering between letters

**Written 2026-07-31. Design note — nothing here is built yet.**

Mridul spotted this: when the cam turns from one letter to the next, it passes through every
letter in between, so **the dots jump up and down repeatedly before settling**. For a blind reader
resting a finger on the cell, that is garbage. It also looks wrong, and it hammers the linkages.

He proposed a **clutch** — drop the motor during rotation so the cam spins free, then re-engage.

This note answers: is the problem real, does that fix work, and what are the options.

---

## 1. Yes, the problem is real — here are the numbers

Counted from the actual encoding in `sim/braillix_params.json` (not estimated):

| change | slices turned | individual dot movements |
|---|---|---|
| a → b | 4 | 7 |
| h → e | 4 | 7 |
| a → t | 18 | 37 |
| e → l | 26 | 53 |
| l → o | 28 | 56 |
| **a → z** | **29** | **59** |

Typing **"hello world"**:

```
   359   dot movements actually performed
    66   dot movements the job requires
  5.4x   wasted motion
```

**Fifty-nine dot movements to change one character** (a→z) is the worst case. Every one of those is
a 1mm resin linkage being lifted against a spring.

### Why it happens

The cam is an **absolute position encoder** — each of the 64 angular slices *is* a letter. To reach
a different letter you must physically rotate there, and the dots follow the tracks the whole way.
This is inherent to a rotary absolute cam; it is not a bug in the profile.

> **Worth knowing:** on a commercial multi-cell display an entire line refreshes while the reader's
> hand is elsewhere, so this matters less. On a **single-cell teaching device the finger is on the
> cell while it changes**, which is exactly why it matters here. Commercial displays did not solve
> this with a clutch — they use one latching actuator per dot.

---

## 2. The correction: dropping the motor does not free anything

This is the counter-intuitive part, and it changes the whole design.

Each return spring pushes its linkage **DOWN onto the cam**. So if the cam drops, the linkage
simply follows it down. The foot never leaves the cam surface.

```
   BEFORE                          AFTER dropping the cam 1.2mm
   spring pushes down              spring still pushes down
        │                                │
        ▼                                ▼
     [linkage]                        [linkage]      ← follows the cam down
        │foot                            │foot
   ▂▂▂▂▂█▂▂▂▂▂  cam                      │
                                    ▂▂▂▂▂█▂▂▂▂▂  cam (1.2mm lower)

   feet still touching. bumps still drive them. nothing freed.
```

But this is **not** a dead end, because it still solves the reader's problem — it just solves it a
different way than expected. That splits into two genuinely different mechanisms:

| | What the reader feels | What it fixes | Complexity |
|---|---|---|---|
| **Blanking** — drop the cam ~1.2mm | Every dot goes **below** the reading surface. A clean blank cell, then the finished letter. | Reader experience ✅ | One moving assembly |
| **True declutch** — add a hard down-stop, then drop the cam below it | Same, plus the feet genuinely leave the cam | Reader ✅ + wear ✅ + torque ✅ | Two mechanisms |

**Blanking needs no down-stop and no extra part beyond the drop itself**, because the dots do not
need to stop moving — they only need to stay below the surface where a finger cannot feel them.

**The stated goal is the reader experience, so blanking is sufficient.** Everything below is
measured against that.

### How far does it need to drop?

`pin_lift` is **0.8mm** (a raised dot stands 0.8mm proud). Drop the cam by more than that and even
a fully-raised dot sits at or below the surface. **~1.2mm** gives 0.4mm of margin.

---

## 3. The space you have to fit it in

Read from the CAD, not from memory:

```
  floor              z   0 ..  4
  electronics pocket z   4 .. 18     14mm — the ULN2003 already lives here (36x46 pocket)
  mid-plate ledge    z  18 .. 20
  mid-plate          z  20 .. 22
  MOTOR BODY         z  22 .. 41     19mm can (M2, measured)
  base plate         z  41 .. 46
  cam disc           z  43 .. 45     + 0.8mm bumps
  linkage feet ride  z  45
  reading surface    z  57.2
```

**There is no spare volume.** The electronics pocket is 14mm and mostly full. Any actuator has to
earn its space from something that is already there.

---

## 4. The options

### A — Drop the whole motor *(the original idea)*

Move the motor and cam together, 1.2mm.

- ✅ Conceptually simplest, cam/shaft alignment is untouched
- ❌ You are lifting **~35g of motor** plus fighting the reaction of six springs (~3N)
- ❌ Needs a hole through the mid-plate for the motor to descend into
- ❌ **The motor wires must flex 1.2mm on every single character change** — that is a fatigue
  failure waiting to happen at thousands of cycles
- ❌ No actuator space left in the electronics pocket

### B — Drop only the cam, on the shaft

Leave the motor bolted down; slide the **cam** along the shaft.

- ✅ **The double-D shaft is already a spline.** It transmits torque at any axial position — this
  is the single most useful fact in this note. The cam can slide up and down and still be driven.
- ✅ Moves ~4g instead of 35g. No wire flexing at all.
- ❌ The hub is **Ø9 sitting inside a Ø10 bore** — there is **0.5mm of radial room**, nowhere near
  enough for a fork or yoke without enlarging the base-plate clearance hole
- ❌ Still needs an actuator somewhere

### C — Passive helical coupling — no second actuator ⭐ most elegant

Use **direction of rotation** as the control signal, with deliberate slop ("lost motion").

The cam is not rigidly keyed to the shaft. The coupling has a **helical slot** with ~20° of play:

```
  CLOCKWISE ──────────────────────────────────────────
  pin climbs the helix  →  cam pushed UP  →  ENGAGED
  pin reaches slot end  →  cam now turns with the shaft

        ▲   ~20 degrees of lost motion
        ▼   (cam moves up/down but does NOT rotate)

  ANTICLOCKWISE ──────────────────────────────────────
  pin descends the helix →  cam pulled DOWN 1.2mm  →  BLANK
  pin reaches slot end   →  disc spins freely, dots stay sub-flush
```

To show a new letter:

1. Run **CCW** ~20° → cam drops, **dots go blank** (disc has not turned yet)
2. Keep running **CCW** round to the target slice — the reader feels nothing
3. Run **CW** ~20° → cam lifts, **the new letter appears**

- ✅ **No second actuator, no extra wiring, no extra current, no space cost**
- ✅ Travel becomes one-way, which normally costs up to 63 slices instead of ≤32 — but that is
  **free here**, because the dots are blanked during travel. It only costs time.
- ❌ Hardest thing in this note to design and to print. A helix in resin at Ø9 with 1mm walls.
- ❌ The 28BYJ-48 gearbox has significant backlash, which will interact with the lost-motion arc
  and must be characterised on the real motor

### D — Lift the linkages instead ❌ ruled out

Raising the followers off the cam raises **all six dots at once**. The reader would feel a full
cell of raised dots during every transition — worse than the flicker. Rejected.

### E — Sliding shutter over the reading surface

A thin plate slides across the dots during the change.

- ✅ Conceptually simple, and it is a pure reader fix
- ❌ Must live in the **0.8mm finger-pad recess**. A plate plus its actuation in 0.8mm is not
  realistic at this scale.
- ❌ Does nothing for wear or torque

### F — Two cams, 8 states each — not a clutch, but nearly free 🔑

Already on the table as the likely fix for **R-07** (the cam pressure angle). Split six dots across
two discs of 8 states each: 8 × 8 = 64 combinations.

Measured on the same "hello world" test:

```
  one 64-state disc   359 dot movements
  two 8-state discs    93 dot movements
                      3.9x less chatter
```

- ✅ **No new mechanism at all** — it is a re-layout you may be forced into anyway
- ✅ Also fixes the pressure angle (9–12° vs the current 71–79°)
- ❌ Costs a **second motor per cell**
- ❌ Reduces the flicker ~4×, does not remove it

---

## 5. Actuator reality check

For options A, B and D you need something to do the moving:

| | Size | Verdict |
|---|---|---|
| SG90 micro servo | 23 × 12 × 29mm | ❌ **Will not fit** beside the ULN2003 in a 36×46×14 pocket |
| Micro solenoid | ~10 × 10 × 15mm | ⚠️ Might fit. Costs a driver channel, continuous holding current, and heat |
| Second 28BYJ-48 | Ø28 × 19mm | ❌ No |
| Nitinol (muscle wire) | negligible | ⚠️ Tiny, but slow and needs current control |

**This is the main argument for option C.** It is the hardest to design and the only one that
costs no space and no electronics.

---

## 6. Recommendation

**1. Blanking is enough.** The goal is the reader. A full declutch buys wear and torque savings
that are not currently the problem, at roughly double the complexity.

**2. Do not build any of this yet.** Two reasons:

- **R-07 is unresolved.** If the cam ramp turns out to be unclimbable, the disc architecture
  changes and any clutch designed against the current 64-state disc is scrapped.
- **Option F may make it unnecessary.** If R-07 forces the two-cam split, chatter drops ~4× on its
  own. That may be good enough without any clutch at all.

**3. The test that decides it costs two minutes.** When the resin lands (~4 Aug), rest a linkage
foot on a cam track and turn the disc by hand. That settles R-07, and R-07 settles which
architecture the clutch would have to be designed for.

**4. If it does get built, start from option C**, and fall back to B with a micro solenoid if the
helix proves unprintable.

---

## Reproducing the numbers

Everything in section 1 comes from `sim/braillix_params.json`, which is itself generated from the
CAD by `sim/extract_params.py`. Sweep each pair the short way round the disc and count the bits
that flip between adjacent slices — a flipped bit *is* a dot moving:

```python
def sweep(a, b, states=64):
    fwd, rev = (b - a) % states, (a - b) % states
    step, n = (1 if fwd <= rev else -1), min(fwd, rev)
    moves, cur = 0, a
    for _ in range(n):
        nxt = (cur + step) % states
        moves += bin(cur ^ nxt).count('1')
        cur = nxt
    return n, moves
```

The two anchors to check against: **a→z = 59 dot movements**, **"hello world" = 359**.

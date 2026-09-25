# Braillix — Braille Readability Review
> Would a blind person actually be able to read this?
> Reviewed 2026-07-29 against Library of Congress / Marburg Medium braille specifications.
> All "Braillix" numbers taken from `cad/scad/mech_layout.scad`, not from memory.

---

## 1. Scorecard

| Parameter | Braille standard | Braillix | Verdict |
|---|---|---|---|
| Dot base diameter | 1.44 – 1.60 mm | **1.5 mm** | ✅ **IN SPEC** |
| Dot height (travel) | 0.46 – 0.50 mm | **0.8 mm** | ⚠️ **1.6× too tall** |
| Within-cell **vertical** spacing | 2.30 – 2.50 mm | **2.6 mm** | ✅ marginal (4% over) |
| Within-cell **horizontal** spacing | 2.30 – 2.50 mm | **4.8 mm** | ❌ **1.9× too wide** |
| Cell-to-cell pitch | 6.10 – 6.50 mm | **68 mm** | ❌ **10.5× too wide** |

**Two of five are correct, one is marginal, two are not.** The two failures are different in kind: one is
fixable, one is architectural.

---

## 2. What we're getting RIGHT

**The dot itself is now genuinely correct.** At 1.5 mm base diameter it sits squarely inside the
1.44–1.60 mm standard. A trained reader's fingertip would register it as a proper braille dot, not a lump.

This happened almost by accident — the dot shrank from 2.2 mm to 1.5 mm in v7.1 because a 2 mm spring had
to fit around it. A constraint from the mechanism pushed the design *toward* the standard rather than away
from it. Worth saying out loud in the presentation: the dot is spec-compliant.

**Vertical spacing is effectively correct** at 2.6 mm against a 2.30–2.50 mm standard. 4% over is inside
the tolerance a reader would notice.

**The dot is a smooth printed dome**, not a glued-on bearing ball with an adhesive fillet around its base.
Readers detect dot *shape*, and a clean hemispherical dome is the right profile.

---

## 3. What needs attention

### ⚠️ Dot height 0.8 mm — 1.6× the standard, and easy to fix

Standard braille dots rise **0.46–0.50 mm**. Ours rise **0.8 mm**. A dot this proud feels sharp and
"spiky" to an experienced reader, and it makes a raised dot harder to distinguish from the plate edge.

**This is the single most fixable readability problem.** It is one parameter — `pin_lift` in
`mech_layout.scad` — and lowering it to 0.5 mm would:

- bring dot height into spec, **and**
- ease the cam ramp problem at the same time (a shorter rise needs a shorter ramp, which buys back flat
  dwell on the outermost track, which was the tightest constraint in the whole cam)

**Caveat:** changing `pin_lift` ripples through the vertical stack (`link_total_h`, flange clearance,
spring working length). It is a ~1 hour change with re-verification, **not** something to do the week of a
presentation. Recommend: after the demo.

### ❌ The cell is DISTORTED, not "jumbo" — and this may now be fixable

This is the finding worth taking seriously.

```
vertical spacing    2.6 mm   (≈ standard)
horizontal spacing  4.8 mm   (1.9× standard)
```

A genuine large-format braille cell scales **both** axes together. Ours is standard vertically but nearly
double horizontally, so it is not a scaled cell — it is a **stretched** one. It matches no braille
standard, and to a trained reader it would feel wrong in a way that "everything is bigger" would not.

The 4.8 mm figure was locked back when the design used **2.5 mm dot holes**: two 2.5 mm holes on a 2.5 mm
pitch touch edge-to-edge and merge, so the columns had to be spread.

**That constraint no longer exists.** After v7.1, the holes are **1.7 mm**. At standard 2.5 mm pitch that
leaves **0.8 mm of wall** between holes — entirely printable in resin.

So the reason for 4.8 mm was removed by a later change, and nobody revisited it. Bringing columns to
~2.5 mm would make the *within-cell* geometry genuinely standard-compliant — a far stronger claim for both
the presentation and any future patent filing.

**What it would cost:** `dot_pos()` changes (x = ±1.25 instead of ±2.4), which recomputes every linkage
arm length and assembly angle, plus a re-check that the 2.2 mm spring bores still clear at the tighter
pitch (0.3 mm walls — tight, needs verification). Half a day with full verification. **Not before the
demo** — but this is the highest-value design improvement remaining in the project.

### ❌ 68 mm between characters — architectural, do not try to "fix"

A 28BYJ-48 motor is 28 mm in diameter. One motor per character therefore cannot sit at 6.1 mm reading
pitch — not with better CAD, not with tighter tolerances. It is geometry, not engineering debt.

**A finger cannot sweep a word.** Standard braille lets one fingertip (~10–12 mm pad) travel continuously
along a line; at 68 mm pitch the reader lifts and repositions for every character. That is not reading,
it is sequential character identification — a different, much slower cognitive task.

**This is why the honest framing is "modular braille teaching device", not "refreshable braille display".**
Own it in the presentation. Evaluators respect a team that knows the limits of its own architecture; they
do not respect a team that claims a $2000 display and demos something 11× too wide.

---

## 4. So — could a blind person read it?

**One character at a time: yes, probably.** The dot size is correct, vertical spacing is correct, and the
dome profile is right. A braille reader placing a finger on a single cell would likely identify the
character — though the horizontal stretch would feel unfamiliar and slow them down.

**A word or a sentence: no.** At 68 mm per character it is not readable text; it is a sequence of
individually-inspected symbols.

**Which is exactly right for the product this actually is.** For a *learner* — a child being taught which
dots make an "a" — a large, clearly separated, slightly-taller-than-standard dot on a single cell is
arguably *better* than a compact standard cell. The design's weaknesses as a reading device are close to
strengths as a teaching device.

---

## 5. Accessibility features worth adding for the demo

Cheap, fast, and they demonstrate that accessibility was designed in rather than bolted on:

1. **Audio pairing (highest impact, ~₹100).** A small speaker or buzzer that speaks or beeps the character
   as it is displayed. Turns a silent mechanism into a multi-sensory teaching tool and gives evaluators
   something to *hear*, not just watch. This is the single best demo addition available.
2. **Tactile orientation markers — already in the design.** The chevron on the box front and the ridge on
   the bottom edge tell a blind user which way is up by touch. Point this out; it is exactly the kind of
   detail evaluators look for.
3. **Tactile part identification — already in the design.** The pod lid has raised ridges, and the nav
   caps carry ◁ ○ ▷ symbols so the buttons are distinguishable without sight.
4. **Homing feedback.** Have the cell audibly or visibly confirm it found home on power-up. Shows the
   hall-sensor subsystem working and reassures a blind user that the device is ready.
5. **Say the words "we consulted the standard".** Bring this scorecard. Being able to state
   "our dot is 1.5 mm against a 1.44–1.60 mm standard; our character pitch is deliberately non-standard
   because of the motor, and here is why" is far more convincing than claiming everything is perfect.

---

## 6. Recommended actions, in order

| Priority | Action | Effort | When |
|---|---|---|---|
| 1 | Add audio feedback for the demo | ~2 h + ₹100 | Before PPT |
| 2 | Bring this scorecard to the presentation | 0 | Before PPT |
| 3 | Reduce `pin_lift` 0.8 → 0.5 mm (in spec + eases cam ramps) | ~1 h | After PPT |
| 4 | Investigate column pitch 4.8 → 2.5 mm now that holes are 1.7 mm | ~4 h | After PPT |
| 5 | Keep the 68 mm pitch and the teaching-device framing | 0 | Permanent |

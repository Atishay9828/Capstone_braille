# Braillix — Hardware Sourcing Guide (India)
> Created 2026-06-12 (v6.1). What to buy, what to search for, what's already in hand.

## ✅ Already in hand (validated)
| Item | Status |
|---|---|
| 28BYJ-48 stepper + ULN2003 driver module | working on breadboard |
| ESP32 DevKit V1 | working, WiFi + OTA tested |
| NeFeB disc magnets **8mm dia × 1mm thick** | plenty — CAD v6.1 pockets sized for these |
| Hall sensor (SS49E-class) | validated (saturates 0/4095, fine for edge homing) |
| 6×6mm tactile switches ×3 | in hand |
| Inline female DC pigtail jack + 5V/3A adapter | in hand; current pod choice; polarity verified red = positive |
| Jumper wires (Dupont) | in hand (housings get cut off for in-cell wiring) |

## 🛒 TO BUY

### 0. Enclosure power connector — no new purchase for this revision

Use the owned inline pigtail. Its body remains outside the pod; only the two leads pass through the
coupon-selected lid slot and tie to the internal strain-relief post. Print
`pigtail_slot_coupon.gcode` before finalizing `power_cable_slot_w/h`. A threaded panel-mount jack is
only a future redesign option.

### 1. Return springs x6 (+ spares) — 2mm OD MICRO springs
**Spec: 2.0mm OD, ~0.3mm stainless wire, ~4mm free length.** One per braille dot.

> ⚠️ **Ballpoint-pen springs CANNOT be used.** They are ~4mm OD and need ~4.2mm of
> spacing; braille rows are only **2.6mm** apart, so a pen spring would overlap the
> spring of the dot above it by 1.4mm. This is geometry, not preference — no nub size
> fixes it. 2mm OD is the largest that fits (0.6mm to spare).

- Search **"micro compression spring 2mm OD"** or **"compression spring assortment kit"**
  on Amazon.in. 2mm/3mm/4mm/5mm/6mm OD in 0.3mm stainless is a standard catalogue range.
- **Buy an assortment kit** (200-400pcs, 15-30 sizes, roughly Rs 400-700) rather than one
  size — it covers us if the free length needs adjusting after the first assembly.
- If a seller offers **0.2mm wire**, prefer it: same OD but a wider bore, which gives more
  clearance around the 1.0mm nub.
- Working range in the design: 3.0mm when the dot is down, 2.2mm when raised. A ~3.5-4.0mm free
  length with ~5 coils is the test range (<=1.5mm solid height, so it never bottoms out).

**Fitting them:** thread each spring over the 1.5mm dome by TWISTING it on (the coil acts
like a thread against the 1.4mm bore — 0.1mm interference, trivial for steel). Then it sits
on the linkage flange and drops into the counterbore in the resin dot insert. Do not glue the spring before the bench test.

**Backup if springs cannot be sourced:** a small disc of **soft open-cell sponge** in place
of each spring. Must be squishy sponge/upholstery/packing foam — **NOT stiff EVA craft
foam**, which is roughly 20x too stiff and risks stalling the motor. Free from packaging.
The printed parts are identical either way, so this can be tested without a reprint.

### 2. Homing magnets 3×1mm ×1 per cell — small but specific
Your 8×1mm magnets are for DOCKING. The cam's homing pocket (`braille_cam.scad`) needs a
**3mm dia × 1mm thick** disc — an 8mm one will not fit and a 2mm-thick magnet destroys the cam floor.
- Search: **"3x1mm neodymium magnet"** on robu.in / Amazon.in — verify the actual thickness.
- Glue flush into the cam underside pocket at r=17.35 (the 90° position).

### 3. ~~Bearing balls 2mm~~ — NO LONGER NEEDED (v7.1)
The braille dot is now **printed as a dome on the linkage itself**. No steel balls, no
glue, no machined cup. If you already bought balls, keep them for something else.

### 3b. Glue for the dot insert (v7.2)
The top plate is now PETG/FDM with a small **resin dot insert** glued into a pocket.
- **CA (superglue) or 5-min epoxy** — either works. Epoxy is more forgiving (you get
  time to seat it square); CA is instant but unforgiving.
- Bead it on the **rebate shelf** (the 2mm-wide ledge, ~106mm² of contact), not on the
  insert. Drop the insert in flange-down; it self-locates.
- **Wipe squeeze-out from the top face before it cures.** If glue reaches the six dot
  holes the domes will jam and the cell is dead.

### 4. Pogo connector (4-pin) — DEFERRED DECISION (per v6 audit)
Don't buy until the electrical architecture and carrier are pinned. A 0.5A/contact part is
insufficient for the aggregate chain. Require >=1A continuous/contact at working compression,
preferably 2-3A on power, and a flush internal carrier. Two candidate styles:
- **Spring-loaded pogo pin strip, 4-pin, 2.54mm pitch** (search "pogo pin connector 4 pin
  2.54mm") — what the CAD windows roughly assume; needs a mating flat-pad part.
- **Magnetic pogo connector module** (search "magnetic pogo connector 4 pin") — combines
  the magnet + contacts in one part; would simplify the dock AND solve the upside-down
  anti-reversal problem at the connector level (these are polarized).
**When the part arrives → measure it → update `pogo_carrier_*` dims in outer_box.scad
before the final print.** Current pocket dims are placeholders.

The four-contact 5V/GND/SDA/SCL bus is future-only: every cell still needs a 3.3V-powered
expander/regulator or explicit level shifting. Tomorrow's direct one-cell build uses the separate
8-wire rear harness, not the pogo window.

### 5. Fasteners (one trip to a fastener shop / one Amazon order)
| Item | Qty (1 cell + pod) |
|---|---|
| M2.5 × 25mm bolts | 4 |
| M2 × 8mm self-tap screws | 2 (pod lid) |
| M2 × 6mm self-tap screws | 4 only if the deferred muscle board is ever built |
| M4 × 5mm thread-forming screws | 2 (motor ears; coupon first; do not use M4×6/x10 without measured clearance) |
*not needed while running the ULN2003-on-floor prototype

### 6. Consumables
CA glue (balls + magnets), silicone grease (cam tracks), heat-shrink, solder.

## 🏭 NOT bought — manufactured
| Item | How |
|---|---|
| Linkages ×8 (6+2 spares) | **Resin print** with the cam/top_plate/nav_cap batch — tough/ABS-like resin, flat on plate (v6.1 decision; was laser-cut metal) |
| Muscle board PCB | Deferred — prototype runs the off-the-shelf ULN2003 module on the pocket floor (see WIRING_AND_ASSEMBLY.md) |

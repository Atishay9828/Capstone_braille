# Braillix — Master Bill of Materials

> **Supersedes `docs/SHOPPING_LIST.md`** (that file still lists 4mm pen springs and 2mm bearing
> balls — both wrong since v7.1). Buy from this file only.
>
> Scope: **1 Brain Pod + 1 Cell**, enough to make one dot go up and come back down.
> Budget ₹15,000 · already spent ₹935 (J.B. Enterprises).
>
> Fastener quantities are **derived from the `.scad` sources and verified**, not estimated —
> each row names the feature it serves. Prices are realistic Indian estimates (Amazon.in /
> robu.in / local market), marked **~** where not quoted from a specific listing.

---

## Status legend
| | Meaning |
|---|---|
| ✅ **HAVE IT** | Already owned — from the ₹935 bill or stated in hand |
| ❌ **NEED TO BUY** | Not owned. Where + estimated cost given |
| ⚠️ **HAVE BUT WRONG** | Owned, but the wrong spec or not enough |

---

## 1. Electronics

| Component | Status | Action Needed |
|---|---|---|
| ESP32 DevKit V1 (30-pin, USB-C) | ✅ HAVE IT | — |
| 5V/3A power adapter | ✅ HAVE IT | — |
| Inline female DC pigtail jack | ✅ **HAVE / CURRENT POD CHOICE** | Connector body remains outside; only the red/black leads pass through the lid slot and are strain-relieved on the internal tie post. Polarity measured correct 2026-08-01, red = positive. Prove slot size with `pigtail_slot_coupon.gcode`. |
| Threaded 5.5×2.1mm female panel-mount jack | ⛔ **NOT REQUIRED FOR THIS REVISION** | The old guessed panel-jack cradle was removed. Reconsider only in a future enclosure redesign. |
| 28BYJ-48 stepper motor (5V) | ✅ HAVE IT / MEASURED | Fit-critical caliper readings recorded, including M5=3.0mm. Vertical stack still needs one coordinated CAD pass. |
| ULN2003 driver module | ✅ HAVE IT | Nominally fits the 14mm pocket **only** with wires soldered flat (~12mm). Vertical Dupont headers will not fit; final board/tail measurement and retention are still required. |
| Hall sensor — MH-Sensor-Series (blue module) | ⚠️ **HAVE BUT WRONG FORM FACTOR** | The whole blue PCB will not fit. v7.5 provides a **4.5 × 3.5 × 1.6mm underside pocket** for its bare TO-92 sensor. M11b is exactly 1.6mm, so dry-fit before gluing. Desolder the sensor and run three wires back; use analog AO behavior for homing. |
| Neodymium magnets 8×1mm (docking) | ✅ HAVE IT | 10 purchased. 4 needed per cell (2 per ±X face). |
| Homing magnet **3×1mm** (for the cam) | ❌ NEED TO BUY | 1 per cell. The blind pocket is 1.2mm deep and leaves 0.8mm of cam floor. An 8×1mm docking magnet is too wide. |
| Tactile switches 6×6×5mm | ✅ HAVE IT | 3 needed (pod nav buttons). Not required for a Tier-0 demo. |
| Female header strips 1×15 | ❌ NEED TO BUY | 2 for the pod DevKit mount. ~₹40. Not needed for a breadboard demo. |
| USB-C cable (data, not charge-only) | ❌ NEED TO BUY / verify | Must carry **data**. Many charge-only cables look identical and silently fail to flash. ~₹150. |
| Resistors / capacitors | ✅ **NOT NEEDED** | 4.7k I²C pull-ups are only for the multi-cell I²C bus, which is not in the demo. No protection parts needed for a single cell. |
| Pogo pin connectors | ⏸️ **DEFERRED** | Do not buy yet. Require a measured flush carrier and >=1A/contact continuous (prefer 2-3A for power). The four-wire architecture also needs a per-cell 3.3V expander interface. |

## 2. Mechanical & fasteners
*Counts derived from the SCAD sources and verified against them.*

| Component | Qty | Status | Serves / Action |
|---|---|---|---|
| **M2.5 × 25mm bolts** | 4 | ❌ NEED TO BUY | `top_plate` counterbores → `base_plate` standoffs → `outer_box` corner bosses. Verified: 25mm gives ~9.5mm engagement. ~₹60 |
| **M4 × 5mm thread-forming screws — BRASS** | 2 | ⏸️ SELECT AFTER COUPON | Motor ears into the Ø3.3/3.4/3.5 coupon-selected through pilots. **Do not use M4×6 or M4×10** until the real ear and screw point prove ≥0.5mm cam clearance. No nuts. ⚠️ **BRASS, not steel** (added 2026-08-21): the homing magnet is now 8×1mm and the screw at x=+9.85 sits ~8mm from its orbit — a steel screw adds ~5 mN·m of cogging, about 10% of motor output, which R-07 leaves no margin for. |
| **M2 × 8mm self-tap** | 2 | ❌ NEED TO BUY | Pod lid → shell bosses. 🔴 **NOT M2×6** — through a 4mm lid that leaves only **2mm** of thread; 8mm gives 4mm. Verified. ~₹40 |
| M2 × 6mm self-tap | 4 | ⏸️ DEFERRED | Muscle-board bosses. Not used in the prototype (ULN2003 sits on the pocket floor). |
| **2mm OD micro compression springs** | 6 + spares | ❌ NEED TO BUY | 🔴 **CRITICAL, no substitute.** 2.0mm OD, ~0.3mm stainless wire, ~4mm free length. Pen springs (4mm) **cannot** work — braille rows are 2.6mm apart. Buy an **assortment kit** (200–400pcs) so you're not betting on one guess. ~₹500 |

## 3. Consumables

| Component | Status | Action Needed |
|---|---|---|
| Solder wire | ❌ NEED TO BUY | **0.8mm, 60/40 rosin-core.** Not plumbing solder. ~₹150 |
| Flux paste | ❌ NEED TO BUY | Not strictly required, but makes soldering to ULN2003 pins far easier for a beginner. ~₹100 |
| Superglue (CA) **or** 5-min epoxy | ❌ NEED TO BUY | Glues the resin `dot_insert` into the PETG top plate, and the magnets. **Epoxy recommended** — it gives you time to seat the tile square. ~₹80 |
| Heat-shrink tubing (1–3mm assorted) | ❌ NEED TO BUY | Insulating soldered joints. ~₹80 |
| Electrical tape | ❌ NEED TO BUY | ~₹30 |
| Silicone grease | ❌ NEED TO BUY | Cam tracks, to reduce stall risk. A tiny amount. ~₹80 |
| Dupont jumper wires | ✅ HAVE IT | 2m wire + spares purchased. For counts see below. |
| Breadboard | ❌ NEED TO BUY | **Yes, still needed** — the Tier-0 demo is breadboard-based, and it is the safest way to bring up wiring before anything is soldered. Half+ size. ~₹100 |

**Dupont counts for the demo wiring** (13 connections total): **M-F ×8** (ESP32 header → breadboard/module), **M-M ×5** (rail to rail, module to rail). F-F not needed. If your 2m wire is bare, you need crimps or you solder directly.

## 4. Tools

| Tool | Status | Action Needed |
|---|---|---|
| Soldering station | ❌ **NEED TO BUY** | 🔴 **Not owned** (an earlier revision of this file wrongly said it was). Buy a **60W temperature-controlled "936" station with a 2.4mm chisel tip**, ~₹1,300 — NOT a plain ₹200 pencil iron. Full reasoning in `ELECTRONICS_PLAN.md` Part 9. |
| **Digital multimeter** | ✅ **HAVE IT** (bought 2026-08-01) | Jack polarity measured and **confirmed correct** — red = positive. The largest single risk to the ESP32 is retired. |
| **Digital calipers** | ✅ **IN HAND / USED** | Motor, Hall thickness, and ESP32 row-pitch readings recorded on 2026-07-31. |
| Wire stripper / cutter | ❌ NEED TO BUY | ~₹200 |
| Desoldering pump or wick | ❌ OPTIONAL | Useful if you need to lift the TO-92 off the hall module, or fix a bridge. ~₹120 |
| Tweezers | ❌ OPTIONAL | Strongly recommended for 2mm springs and 1mm linkages. ~₹80 |
| Small drill bits (1.5/1.7/2.5mm) | ❌ OPTIONAL | FDM holes print 0.2–0.3mm undersize; these clean them out. ~₹150 |

### Soldering difficulty — the honest read
**Nothing in the demo build requires fine-pitch work.** The hardest joint is soldering wires flat
onto the ULN2003's 2.54mm header pads — comfortably within basic skill.

The **only** fine-pitch work in the whole project is the custom muscle board (TQFP-32 at 0.8mm
pitch, SOIC-16, 0402 passives). That is **beyond basic soldering** — order it assembled (PCBA)
or stay on the ULN2003 module. It is not needed for the demo either way.

---

## 5. What to actually spend

| Path | Contents | Cost |
|---|---|---|
| **🎯 Cheapest working demo** | multimeter, breadboard, solder wire, strippers, USB-C cable | **~₹1,100** |
| **+ mechanism** | above + springs, homing magnet, fasteners, glue, calipers | **~₹2,900** |
| **Everything in this BOM** | all of the above + optional tools + consumables | **~₹3,900** |

**Project total if you buy everything: ₹935 + ~₹3,900 = ~₹4,835 of ₹15,000.** Comfortable.

> **Deliberately excluded: the resin print order.** Do the cheap PETG proving print and make one
> dot move *before* spending on resin. Every downstream decision rests on a mechanism that has
> never been physically tested.

---

## 6. Buy these first (this week)

1. **Multimeter** (~₹500) — unblocks safe power-up. Nothing else can happen safely without it.
2. **Breadboard + USB-C data cable + solder wire** (~₹400) — everything needed for the Tier-0 demo.
No panel-mount jack is required for the current revision; use the owned pigtail and prove its cable-only slot first.

Calipers are now in hand and the motor, Hall thickness, and ESP32 row-pitch measurements are recorded.

---

## 7. Unverified — measure before buying or printing

| # | What | Feeds |
|---|---|---|
| 1 | Motor vertical stack re-derivation from the completed owned-part readings | `base_plate`, `mid_plate`, cam bore |
| 2 | Smallest pigtail cable slot that passes both insulated leads without damage | `power_cable_slot_w/h` in the pod lid; use the 5x3 / 6x4 / 7x5 coupon |
| 3 | Hall module PCB dimensions (or switch to bare TO-92) | `base_plate` hall pocket |
| 4 | Actual magnet diameter/thickness from the bill | dock magnet pockets (CAD assumes 8×1mm) |
| 5 | ESP32 board length/width if the catalogue envelope proves tight; pin-row pitch is measured 25.6mm | pod board envelope |
| 6 | Pogo connector, once chosen | `outer_box` pogo carrier pocket |

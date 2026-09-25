# CAD FIT CHECK — will the real parts fit the printed parts?

> ## ⚠️ SUPERSEDED IN PART — read `CAD_CHANGELOG_v7.5.md` alongside this
>
> This document audited **v7.2/v7.3**. On 2026-07-30 a repair pass (**v7.5**) fixed every
> defect that did not require calipers. The findings below are preserved as the *record of
> what was wrong*, but the following are **FIXED and no longer describe the source**:
>
> | Section | Defect | Status |
> |---|---|---|
> | §2a | Hall pocket entirely inside the cam pocket | ✅ rebuilt on the plate underside at (0, 17.35) |
> | §2c | Homing magnet craters the cam tracks | ✅ blind 1.2mm pocket, 3×1mm magnet (it craters **three** tracks, not two — §2c undercounts) |
> | §3a | Right motor screw opens into the spring cavity | ✅ spring cavity deleted; pilots instead of clearance holes |
> | §3b | Left ear hole 0.35mm from the plate edge | ✅ `base_length` 56 → 58, wall now 1.35mm |
> | §5 | Muscle-board bosses clash with the ULN2003 | ✅ bosses now default OFF |
> | §6a | ESP32 overruns the pod by 1.75mm | ✅ `pod_length` 64 → 68 |
> | §6c | USB cutout ~2mm too high | ✅ arithmetic bug fixed (ignored `hdr_channel_depth`) |
> | §6d | USB cutout too small for a real plug | ✅ 10×7 → 13×9 |
> | §7 | Guessed panel-jack hole/cradle | ✅ removed; current lid uses an outside inline pigtail, cable-only slot, and internal tie post |
>
> **Still open after the completed measurements** (see `MEASUREMENTS_NEEDED.md`):
> §4c motor/cam vertical-stack re-derivation · §2b physical Hall-pocket dry-fit ·
> §7 selecting the smallest safe inline-pigtail cable slot with the printed coupon.

> ## 2026-07-31 measurement-research update
>
> The online and owned-part pass is recorded in `MEASUREMENT_RESEARCH.md`.
>
> - Motor M1–M9 now include the fit-critical owned readings; M5 is 3.0mm across flats.
> - M11b is measured at 1.6mm. The recess is also 1.6mm, so geometry passes but a printed
>   dry-fit is still required because there is no manufacturing margin.
> - M18 is a 30-pin USB-C ESP32 and M21 is measured at 25.6mm. The live socket channels now use it.
> - The owned power part is an inline female DC pigtail. For the current pod its body stays outside;
>   only the cable pair crosses the lid and an internal tie post carries pull load. Select the
>   smallest 5x3 / 6x4 / 7x5 slot with `pigtail_slot_coupon.gcode`.
>
**Date:** 2026-07-29
**Scope:** physical fit of purchased/owned components inside the v7.2 printed parts.
**Status of the build:** nothing has ever been assembled. This is the last check before spending.

## How to read this document

Every statement is tagged:

- **[SCAD]** — read directly out of the OpenSCAD source in `cad/scad/`. This is fact about the
  *printed part*.
- **[SPEC]** — a published nominal figure for a standard catalogue part (28BYJ-48, 6x6 tactile
  switch, 5.5/2.1 barrel jack, micro-USB). Standard parts still vary between clone vendors.
- **[ASSUMED]** — a number somebody typed into the CAD about a physical object that has never
  been measured. Treat as fiction until a caliper says otherwise.

**Historical note:** when this v7.2/v7.3 audit was written, the "Real part needs" column was unmeasured.
Several owned-part dimensions have since been measured; use `MEASUREMENT_RESEARCH.md` as the current evidence table.

---

## 1. SUMMARY TABLE

| Component | CAD provides [SCAD] | Real part needs | Verdict | Action |
|---|---|---|---|---|
| **Hall sensor (MH-Sensor-Series / KY-024 module)** | 5.3 x 4.3 x 3.0 mm pocket at (0, +20) in `base_plate` | PCB module ~15 x 11 x 1.6 mm + ~11 mm of 4-pin header [ASSUMED] | **FAILS** | Desolder the bare sensor, or move the module out of the plate entirely |
| **Hall pocket itself** | pocket floor z=2; Ø46 cam pocket floor also z=2, and the pocket lies **entirely inside** r=23 | any pocket at all | **FAILS** | The pocket is 100% subsumed by the cam pocket — it does not exist as a feature |
| **Cam homing magnet Ø3x2** | Ø3.2 x 2.0 pocket at r=17.35 in a **2.0 mm** disc floor | 3x2 mm disc magnet — **not owned** | **FAILS** | Pocket is a through-hole that punches a Ø3.2 crater through cam **tracks 2 and 3** |
| **28BYJ-48 motor body** | Ø29 seat, 35 mm hole spacing, Ø4.3 holes, body centre at x=-8, 19 mm of z-space | body Ø28, 35 mm spacing, Ø4.2, ~8 mm offset, 19 mm can [SPEC] | **UNVERIFIED** | Never measured. 8 caliper readings required (§4) |
| **Motor right mounting screw** | hole at (+9.5, 0) falls **inside** the 22 x 16 spring-cavity through-window | material to clamp against | **FAILS** | Motor can only be held by ONE screw |
| **Motor screw head vs cam** | left hole at x=-25.5 is clear; right hole at x=+9.5 is under the Ø46 cam disc | screw head clearance | **FAILS** | No counterbore modelled; head fouls the cam floor |
| **Cam on shaft (double-D bore)** | Ø5.2 clipped to 3.2 flats; **through-hole**, real engagement = hub 4 + floor 2 = **6 mm** | 5.0 mm shaft, 3.0 mm across flats, ~10 mm long [SPEC] | **UNVERIFIED / marginal** | Clearances fine on paper; z-stack is wrong (§5) |
| **Cam z-stack vs motor face** | hub bottom z=39, motor top face z=41 | hub cannot go below the motor face | **FAILS** | Cam bottoms on the motor and sits ~2 mm high → all six dots permanently proud |
| **Shaft protrusion** | cam surface z=45; a 10 mm shaft reaches z=51 | shaft must not enter the dot cluster | **FAILS (conditional)** | Shaft passes through the open bore into the linkage risers at x=±2.4 |
| **ULN2003 module, wires soldered flat** | 36 x 46 x 16 pocket + 2 mm mid-plate relief slot = 18 mm | ~35 x 32 x ~12 mm [ASSUMED, established earlier] | **FITS** | Solder wires flat. Watch the 0.5 mm/side X clearance |
| **ULN2003 module, vertical Dupont jumpers** | same 18 mm max | ~20 mm as-wired [ASSUMED] | **FAILS** | Confirmed: 20 > 18. No vertical jumpers |
| **ULN2003 vs muscle-board bosses** | 4 mm tall bosses at (±14, ±19) rise from the pocket floor | flat floor | **UNVERIFIED** | If the board is ~35 mm in Y it clips the y=±19 bosses |
| **ESP32 DevKit length in pod** | cavity ±28 in X; board 51.5 centred at x=+4 → spans -21.75 .. **+29.75** | board must end inside x=+28 | **FAILS** | 1.75 mm interference with the +X (dock) wall |
| **ESP32 DevKit width / row pitch** | `devkit_width` 28.0, `hdr_row_pitch` 25.4 [ASSUMED] | 30-pin DOIT V1 is commonly ~25.4 wide / 0.9" pitch; 38-pin is ~28 / 1.0" [SPEC-ish] | **UNVERIFIED** | The CAD numbers describe the **38-pin** board; the docs say 30-pin |
| **USB cutout alignment** | cutout z 12.5 .. 19.5; board top sits at z=10.5 (8.5 strip − 1.0 channel recess) | port body ~10.5 .. 13.0 | **FAILS** | Hole sits ~2 mm too high; only ~0.5 mm overlaps the port |
| **USB cutout size** | 10 x 7 mm | micro-USB overmould commonly ~12 x 8 [SPEC-ish] | **UNVERIFIED** | Plug may not enter |
| **Headroom under pod lid** | board top z≈10.5, cavity top z=54 | a few mm | **FITS** | 43 mm spare — grossly over-tall, but no clash |
| **Power cable slot (current source)** | rounded 6 x 4 at (-20, +18) through the 4 mm lid | two insulated pigtail leads only; connector body stays outside | **COUPON REQUIRED** | Test 5x3 / 6x4 / 7x5 and select the smallest damage-free fit |
| **Pigtail strain relief (current source)** | connector body outside; leads tied to existing internal shell post | plug force must not reach ESP32/lid | **DESIGN FIXED / PHYSICAL TEST NEEDED** | Pull-test after selecting the slot and tying the real cable |
| **Docking magnets** | Ø8.4 x 1.2 pockets, 2 per face at y=±14, 4 mm wall | 8 x 1 mm NdFeB discs — **measured, in hand** | **FITS** | Only re-confirm the newly bought batch is the same 8x1 |
| **Nav buttons — cap stem** | Ø3.8 stem projects **4.5 mm behind** the flange through a Ø4.2 hole | must cross a 4 mm wall | **FITS (nominal)** | Stem reaches 0.5 mm inside; 0.4 mm diametral clearance allows resin-in-PETG sliding |
| **Nav buttons — switch reach** | The 6 mm switch body is stopped by the pod's inner front wall; cage back wall takes press load | plunger must meet the stem | **FITS (nominal)** | The front wall is the forward datum; bench-test the actual switch's plunger before final resin batch |
| **6x6x5 tactile switch in cage** | 6.4 mm slot, 7.2 mm depth, legs vertical | 6.0 x 6.0 x 5.0 body [SPEC] | **FITS** | Body and revised cap reach fit on the nominal switch geometry |
| **Dot insert into top plate** | body 11.0 into 11.2 opening; flange 15.0 into 15.2 rebate; heights 2.0 / 1.2; glue shelf 2.0 mm wide, 105.6 mm² | resin tile printed from the same file | **FITS** | Verified numerically. Only risk is FDM square holes printing undersize |
| **Base-plate standoffs** | Ø6 posts at x=±26, plate half-length 28 → 1 mm hangs off the edge | supported footprint | **UNVERIFIED / cosmetic** | Prints as a small unsupported overhang; not structural |

---

## Required outer-box changes — handout checklist

These items are deliberately **not** applied to `outer_box.scad` yet. They either require
the real motor dimensions or a hardware-choice decision; changing them from catalogue
numbers would simply move the fit failure somewhere else.

| Priority | Required change | Why | Prerequisite |
|---|---|---|---|
| Blocker | Re-derive `base_plate_z` and the motor-height allowance | The current 41 mm motor-face height is an unmeasured assumption. It controls the cam/linkage vertical stack. | Measure the actual motor can height and shaft height. |
| Blocker | Redesign the base-plate spring cavity around both motor ears | The right motor screw opens into the existing 22 × 16 mm through-window, leaving a one-screw mount. | Measure the actual motor mounting-ear envelope and hole centres. |
| Blocker | Widen/reposition the base-plate support footprint if the motor-ear fix needs it | The left ear currently has only a 0.35 mm edge wall and the base standoffs overhang the plate by 1 mm. | Motor-ear measurement, then confirm the revised plate still clears the 60 mm shell cavity and corner bosses. |
| Required before installing the owned Hall module | Add a real Hall-module bracket in the outer-box electronics area, or commit to a measured bare-sensor design | The current base-plate pocket is entirely subsumed by the cam pocket and cannot hold the owned module. | Decide module versus desoldered sensor; measure its footprint and sensing-face offset. |
| Decision required | Remove/relocate the four future-muscle-board bosses when using the ULN2003 module | A 35 mm-wide ULN2003 can collide with the y=±19 mm bosses in the outer-box electronics pocket. | Measure the actual ULN2003 board and choose prototype driver versus future muscle PCB. |

**Do not alter the 68 × 68 mm shell, docking windows, magnet pockets, or 4 mm walls as part of
this repair.** Those features are independent of the motor and have already been physically
fit-tested. The next safe sequence is: measure hardware → update the dependent base/mid/cam/
outer-box dimensions together → render the full assembly → print a cheap proving part.

---

## 2. HALL SENSOR — FAILS, twice over

### 2a. The pocket does not physically exist

**[SCAD]** `base_plate.scad`:

- `hall_pocket_h = 3`, cut from `base_thickness - hall_pocket_h` = **z = 2** upward.
- `cam_pocket_depth = 3`, `cam_pocket_diameter = 46`, cut from **z = 2** upward, radius 23.
- Hall pocket footprint: x ∈ [-2.65, +2.65], y ∈ [17.85, 22.15]. Its farthest corner is at
  radius √(2.65² + 22.15²) = **22.31 mm < 23 mm**.

The hall pocket lies **entirely inside the cam pocket, at exactly the same depth**. Subtracting it
removes nothing. There is no rectangular recess on the printed part — just flat cam-pocket floor.

Worse: the cam disc's underside *sits on that floor* (`cam_flat_z = 45`, disc floor 2 mm, pocket
floor z=43 in box coordinates). There is **zero vertical space** above the "pocket" for any sensor,
bare TO-92 or otherwise. The wire channel (`hall_wire_w=2 x hall_wire_d=1`) does survive, but only
in the strip of plate outside r=23.

### 2b. The module is far too big anyway

**[ASSUMED — MEASURE THIS]** The blue MH-Sensor-Series / KY-024-style board Mridul owns (identified
by Codex on 2026-06-03 as an analog+digital module with AO/DO/GND/VCC) is a PCB in the region of
**15 x 11 mm, ~1.6 mm thick, plus a 4-pin 2.54 mm header adding roughly 8-11 mm of height**. Those
figures are typical for that family of modules; they are **not** measured from his part.

Against a 5.3 x 4.3 x 3.0 pocket sized for a bare SS49E/A3144 TO-92 body:

- length: needs ~15, has 5.3 → **~10 mm short**
- width: needs ~11, has 4.3 → **~7 mm short**
- height: needs ~10-13 with the header, has 3 (and really has 0, see 2a) → **hopeless**

### Fixes, in order of preference

1. **Desolder the bare sensor from the module** (recommended). The MH-series board carries a
   standard TO-92 hall device plus an LM393 comparator, an LED and a trimpot. Unsolder the three
   legs, mount the bare TO-92 in the plate, and run three wires back to the module (or straight to
   the ESP32 with a pull-up, since the breadboard test already ran the analog output at 3.3 V).
   This keeps the CAD footprint honest — but §2a still has to be fixed first, because the pocket
   currently isn't there.
2. **Move the module off the base plate entirely.** Mount it on the electronics-pocket floor or on
   a wall of the outer box, with the sensing face pointing up at the cam, and run wires. The cam
   magnet is 3 mm dia — flux falls off fast, so this only works if the module can get within a few
   mm of the magnet path. This is the lowest-CAD-risk option but needs a new bracket.
3. **Enlarge and deepen the pocket.** Requires all three of: (a) make `hall_pocket_h` > 3 so the
   pocket floor drops below the cam pocket floor (e.g. 4.0-4.5 mm, leaving 0.5-1.0 mm of plate
   underneath); (b) grow `hall_pocket_w/d` to the measured module footprint + 0.4 mm; (c) move
   `hall_pocket_y` outboard past y=23 so it is no longer under the disc, **or** add a header
   escape slot. Note the plate is only 5 mm thick and the +Y edge is at y=25 — there is very
   little room. Option 1 or 2 is more realistic.

### 2c. BONUS DEFECT FOUND — the cam homing-magnet pocket is a hole through two tracks

**[SCAD]** `braille_cam.scad`: `magnet_dia=3.0`, `magnet_depth=2.0`, cut as
`cylinder(d=3.2, h=3)` from z=-1, i.e. **z = -1 .. +2**, at r = 17.35, angle 90°.
The disc floor is `disk_base_thickness = 2.0`, spanning z = 0 .. 2.

The cut therefore removes the **entire floor thickness** — it is a through-hole, not a pocket
("leaves 0mm floor" is even in the comment). And at r = 17.35 ± 1.6 it spans r = 15.75 .. 18.95,
which overlaps **track 2** (r 15.4-17.0, drives dot 1) and **track 3** (r 17.1-18.7, drives dot 2).

Where those tracks are in their DOWN state the cam surface at that angle is simply **missing** —
a Ø3.2 mm hole in a running surface that a 1.0 mm-thick linkage foot crosses once per revolution.
The foot will drop in and jam.

**Fix:** shrink `magnet_depth` to ~1.4 mm and thicken the local floor, or (better) move
`magnet_radius` inboard to r < 12 (inside `inner_radius`, under no track at all) and move the hall
sensor to match. Moving the magnet inboard also weakens coupling, so re-check the sensor gap.
Also: **the 3x2 mm homing magnet is not in hand** (`docs/SOURCING.md` §2) — it still has to be bought.

---

## 3. MOTOR — NEVER MEASURED. Treat every motor number as fiction.

> ⚠️ **THE 28BYJ-48 IN THIS PROJECT HAS NEVER BEEN TOUCHED WITH A CALIPER.**
> `base_plate.scad`, `mid_plate.scad` and `braille_cam.scad` all encode motor dimensions that were
> typed from datasheets and forum posts. Mridul has photographed a motor whose shaft looked
> different from the model. Every verdict in this section is conditional on measurement.

**[SCAD] what the CAD assumes:**

| Parameter | Value | File |
|---|---|---|
| body diameter | Ø29 (seat pocket, 1.5 mm deep) | `base_plate.scad` |
| retaining collar ID | Ø29.5, 8 mm tall, at x=-8 | `mid_plate.scad` |
| mount-hole spacing | 35 mm | `base_plate.scad` |
| mount-hole diameter | Ø4.3 | `base_plate.scad` |
| shaft offset from body centre | -8 mm (shaft at x=0, body at x=-8) | `base_plate.scad`, `mid_plate.scad` |
| can height allowance | 19 mm (z=22 .. 41) | `outer_box.scad` `base_plate_z` |
| shaft | Ø5.0, 3.0 across flats, 10 mm long | `braille_cam.scad` comments |

**[SPEC]** The published nominal 28BYJ-48 is: can Ø28 x 19 mm, mounting bracket holes 35 mm apart
at Ø4.2, shaft offset ~8 mm from the can centre, shaft Ø5.0 with two flats ~3.0 mm apart,
protruding ~10 mm. So the CAD is *plausible*. Clone variance and the 19 mm z-budget with **zero**
slack are the risks.

### Two hard failures that exist regardless of measurement

**3a. The right-hand motor screw has nothing to screw into.**
**[SCAD]** `spring_cavity()` is `cube([22, 16, 20], center=true)` — a through-window spanning
x ∈ [-11, +11], y ∈ [-8, +8]. The right mounting hole is at
x = -8 + 35/2 = **+9.5**, y = 0, Ø4.3 → spans x ∈ [7.35, 11.65].
That is inside the window. There is no plate material there. **The motor can only be bolted by its
left ear (x=-25.5).** A single-screw stepper will rock and lose steps.

**3b. The left ear hole is 0.35 mm from the plate edge.**
x = -25.5, Ø4.3 → outer edge at -27.65; plate half-length is 28. A 0.35 mm wall on a 0.4 mm nozzle
is not a wall. The screw will break out.

**Fix for both:** shrink/reshape `spring_cavity` so it clears x=+9.5 (e.g. two smaller windows, or
move it to -Y), and widen `base_length` from 56 to at least 60 (the box cavity is 60 — so this also
needs the cavity or the standoff pattern revisited).

### Measurements required (feeds → CAD parameter)

1. Can outer diameter → `motor_body_diameter` (base_plate), collar ID (mid_plate)
2. Can height, bracket face to bottom → `base_plate_z` in `outer_box.scad`
3. Shaft centre to can centre → `motor_body_x_offset`, `motor_x_offset`
4. Shaft diameter → cam bore Ø (currently 5.2)
5. Shaft flat-to-flat → cam bore flat clip (currently 3.2)
6. Shaft length above the bracket face → cam `hub_h` + `shaft_bore_depth` + z-stack
7. Mount-hole centre-to-centre → `motor_mount_spacing`
8. Mount-hole diameter → `motor_mount_hole`
9. Shaft boss (raised collar around the shaft) diameter and height → cam hub OD (currently Ø9)

---

## 4. CAM ON SHAFT — clearances OK on paper, z-stack is wrong

### 4a. The bore profile

**[SCAD]** `braille_cam.scad`: `intersection(cylinder(r=2.6), cube([10, 3.2, ...]))` → a Ø5.2
cylinder clipped to 3.2 mm across the flats, on both sides (true double-D).

**[SPEC]** Nominal 28BYJ-48 shaft: **Ø5.0 mm, 3.0 mm across the flats, ~10 mm long**.

- radial clearance: (5.2 − 5.0)/2 = **0.10 mm per side**
- flat clearance: (3.2 − 3.0)/2 = **0.10 mm per side**

That is correct in intent but *very* tight for a printed part. On resin the bore will come out
slightly undersize and will need reaming/filing; on FDM it will be far undersize. Plan on
hand-fitting. Do **not** loosen it blindly — a sloppy double-D on a 5.625° indexing cam translates
directly into dot-position error.

### 4b. Engagement depth is 6 mm, not the 8 mm the comment claims

**[SCAD]** The bore is subtracted over local z = −5 .. +4 (`translate([0,0,-hub_h-1])`,
`h = shaft_bore_depth + 1 = 9`). Material exists only over z = −4 .. +2 (hub 4 mm + disc floor
2 mm). So:

- **actual maximum engagement = 6.0 mm**, and
- the bore is a **through-hole** — it opens onto the top of the disc floor. There is no ceiling and
  therefore **no axial stop** locating the cam on the shaft.

The header comment "Hub 4mm below disc + bore 4mm into disc floor = 8mm total engagement" is stale:
the disc floor is 2 mm, not 4 mm.

6 mm of double-D on a ~10 mm shaft is *acceptable* engagement for this torque, but the missing
axial stop means cam height depends entirely on how far it is pushed on during assembly — with
`pin_lift = 0.8 mm` and dot flushness already fought over in v7.2, that is a real risk. Add a
0.5-1.0 mm shoulder at the top of the bore, or a printed depth gauge.

### 4c. The vertical stack does not close — SHOWSTOPPER (conditional on motor measurement)

Working in outer-box world z **[SCAD]**:

| feature | z |
|---|---|
| motor top / bracket face = base-plate underside | 41 |
| base plate top | 46 |
| cam pocket floor (`base_thickness − cam_pocket_depth`) | 43 |
| cam disc floor bottom → top (`cam_flat_z`) | 43 → **45** |
| cam hub bottom (4 mm below the disc) | **39** |
| shaft top, if the shaft is 10 mm [SPEC] | **51** |

Two consequences:

- **The hub is 2 mm too long.** Only 2 mm of space exists between the cam pocket floor (43) and the
  motor face (41), but `hub_h = 4`. The hub bottoms out on the motor and the disc sits **2 mm proud
  of its pocket**, pushing `cam_flat_z` to 47. Since `link_total_h` is derived from
  `cam_flat_z = 45`, **every one of the six dots ends up ~2 mm permanently proud** — exactly the
  class of bug v7.2 just fixed for a 0.8 mm offset.
- **The shaft sticks out the top.** With the bore open, a 10 mm shaft reaches z=51, i.e. **6 mm
  above the cam surface** (4 mm above it even in the mis-seated position). The dot cluster sits at
  x = ±2.4, y = 0/±2.6 — directly over a Ø5 shaft (r=2.5). The linkage risers occupy 3.5 to
  12.2 mm above the cam surface at exactly those coordinates. **The shaft will foul the dot-2 and
  dot-5 risers.**

**Fixes (all need measurement 6 above first):** shorten `hub_h` to the real gap; counterbore the
base plate around the shaft so the hub can drop; trim the motor shaft; or lower the motor by
increasing the z-budget. Do not guess — measure the shaft, then re-derive the whole stack in one
pass.

---

## 5. ULN2003 IN THE 36 x 46 x 16 POCKET — confirmed

**[SCAD]** `outer_box.scad`: electronics pocket is `cube([36, 46, 16])` centred at x=0,y=0, floor at
z=4, top at z=20 (X=36, Y=46). `mid_plate.scad` adds a through relief slot
`translate([3, -23, -1]) cube([17, 8, 4])` — 17 mm (x=3..20) by 8 mm (y=-23..-15) — giving
**2 mm extra headroom** at that corner only.

| configuration | height [ASSUMED, established earlier] | available | verdict |
|---|---|---|---|
| vertical Dupont jumpers plugged into the ULN2003 header | ~20 mm | 16 mm (18 mm at the relief slot) | **FAILS by ~2-4 mm** |
| wires soldered flat to the board | ~12 mm | 16 mm | **FITS**, 4 mm spare |

**Confirmed: solder the wires flat. No vertical jumpers, no exceptions.** This already matches
`docs/WIRING_AND_ASSEMBLY.md`.

Three secondary cautions:

1. **Plan fit is tight in X.** A ULN2003 driver board is commonly ~35 x 32 mm [ASSUMED — measure].
   If its 35 mm side runs along X it has **0.5 mm per side** in a 36 mm pocket. Orient the 35 mm
   side along **Y** (46 mm) instead.
2. **Muscle-board bosses are in the way.** Four Ø4 x 4 mm tall bosses stand on the pocket floor at
   (±14, ±19). If the ULN2003 is ~35 mm in Y (±17.5) it clips the y=±19 bosses. The pocket is
   currently spec'd for *two different boards* (the future 34x44 muscle PCB and the off-the-shelf
   ULN2003) and only one of them can be there at a time — decide which.
3. **Floor wire gutters** are cut 2.5 mm deep at x ∈ [-18,-11] and [11,18] across the whole pocket.
   A board laid on the floor will bridge them; fine, but it will not sit flat if it has
   through-hole tails on the underside.

The mid-plate relief slot **is correctly placed** for a JST/header edge pointed at the (+X, −Y)
corner — it clears the motor collar (whose max x at y=−15 is +0.5) and the boss hole at (26, −21).
Orient the module accordingly.

---

## 6. ESP32 DEVKIT IN THE POD — FAILS on length and on USB alignment

**[SCAD]** `esp32_pod_params.scad` / `esp32_pod_shell.scad`:
`pod_int_length = 64 − 2·4 = 56` → cavity spans **x ∈ [−28, +28]**.
`devkit_length = 51.5`, `devkit_x_offset = +4`.

### 6a. Length — 1.75 mm interference

Board spans x = 4 − 25.75 = **−21.75** to 4 + 25.75 = **+29.75**.
Cavity ends at **+28**. **The board overruns the +X (dock) wall by 1.75 mm.** It will not go in.

The header channels themselves are fine (they span x = −16 .. +24, retention walls to ±25.5, all
inside the cavity) — it is the *board overhanging the sockets* that hits the wall. The antenna
grille recess in that wall only starts at z=23, far above the board at z≈10.5, so it does not help.

**Fix:** reduce `devkit_x_offset` to ~+2 (giving ~0.25 mm at each end — still too tight) or
lengthen the pod. Realistically `pod_length` needs to go from 64 to ~68, which conveniently also
matches the cell footprint. **Measure the board first.**

### 6b. Width and header pitch — M21 resolved at 25.6mm

**[SCAD/current]** `devkit_width = 28.0`, `hdr_row_pitch = 25.6`. The owned board is confirmed as
15 pins per row / 30 total, USB-C, with 25.6mm measured between the row centres.

**[SPEC, still verify owned board]** Pin count does not identify the transverse footprint.
Commercial 30-pin carriers explicitly support 0.9, 1.0, and 1.1 inch row spacing — 22.86,
25.4, and 27.94 mm. Matching USB-C CH340C listings are approximately 51.5 x 28.5 mm overall.

The live 25.6mm channel spacing now follows the owned board rather than the nominal 25.4mm family.
This resolves the header-location blocker; board insertion still needs a first-print dry-fit.

### 6c. USB cutout — ~2 mm too high

**[SCAD]** `usb_z = pod_floor + hdr_strip_h + 1 = 3 + 8.5 + 1 = 12.5`, cutout 10 wide x 7 tall
→ spans z = 12.5 .. 19.5.

But `hdr_channel_depth = 1.0` recesses the strips 1 mm into the floor, so the strip top — and
therefore the **board underside** — sits at 3 + 8.5 − 1 = **10.5**, not 11.5. A micro-USB socket
sits on the board and stands ~2.5 mm tall → it occupies z ≈ **10.5 .. 13.0**.

Overlap with the cutout: **z = 12.5 .. 13.0, i.e. 0.5 mm.** The port is essentially behind solid
wall. `usb_z` should be ≈ 10.0.

### 6d. USB cutout size and plug reach

- **[SCAD]** cutout is 10 x 7 mm in a 4 mm wall.
- **[SPEC-ish]** a micro-USB plug's *metal shell* is ~7 x 2.5 mm, but the **overmoulded body** on a
  typical cable is ~11-13 mm wide and ~7-9 mm tall. It will very likely not pass a 10 x 7 hole.
- The board's −X edge sits at x = −21.75 while the wall inner face is at −28, so the plug must
  reach **6.25 mm inboard** past the wall to seat. Combined with the overmould, this is unlikely to
  work. Enlarge to ~13 x 9 and reduce the standoff distance.

> **Current source (v7.7): resolved provisionally.** The board was moved toward the USB wall,
> reducing plug reach to 2.25 mm, and the service opening is now **14 x 9 mm**. This deliberately
> preserves the 9 mm overmould height clearance while adding 1 mm of width. Measure M23 only if
> the intended cable body exceeds that envelope.

### 6e. Headroom under the lid — fine

Cavity top at z = 54 (`shell_h = 58 − 4`). Board top ≈ 10.5, tallest DevKit component maybe 5 mm →
z ≈ 15.5. **~38 mm of unused headroom.** No clash with the jack cradle either: the cradle bottom
sits at z = 54 − 11 − 1.5 = 41.5, and it is at y=+18 while the board spans y = ±14.

The pod is enormously over-tall for its contents. Not a fit failure, but worth knowing before
printing 58 mm of PETG.

---

## 7. INLINE POWER PIGTAIL — CURRENT SOURCE CORRECTED; SLOT FIT STILL PHYSICAL

The old Ø11.5 panel-jack hole and unsupported 9.5 x 12 x 11 mm cradle were removed. They described
hardware AJ does not own and the cradle extended below the printable lid.

**[CURRENT SCAD]** `esp32_pod_params.scad` / `esp32_pod_lid.scad` now use:

```
power_cable_slot_w = 6.0;
power_cable_slot_h = 4.0;
power_cable_x      = -20;
power_cable_y      = 18;
lid_h              = 4.0;
```

The owned inline female barrel socket remains outside the pod. Only its two loose insulated leads
pass through the rounded slot, then tie to the existing internal shell post before soldering. This
makes the tie post carry plug insertion/removal force instead of the ESP32 or lid. No panel-mount
jack is required for this revision.

The cable pair was not measured accurately enough to certify 6 x 4 mm from the photo. Print
`pigtail_slot_coupon.gcode`; it reproduces the real 4 mm lid and provides 5x3, 6x4, and 7x5 mm
rounded openings. Try them from smallest to largest and use the first that passes both leads without
scraping, pinching, whitening, or cutting insulation. The connector body must never be forced
through a slot.

The owned pigtail polarity was measured on 2026-08-01: red is centre-positive. The circuit has no
reverse-polarity protection, so re-test if either the pigtail or adapter is replaced.

---

## 8. MAGNETS — the only genuinely measured component. Re-confirm the new batch.

**[SCAD]** `outer_box.scad` and `esp32_pod_params.scad` both use `mag_dia = 8.4`,
`mag_depth = 1.2`, teardrop profile, 2 per face at y = ±14, z = 29, in a 4 mm wall (2.8 mm of
material left behind each pocket).

**[MEASURED, v6.1]** `docs/SOURCING.md` records "NeFeB disc magnets **8mm dia x 1mm thick** —
plenty" and the v6.1 CAD notes say they were measured off the real parts. So 8.4 x 1.2 gives
0.2 mm radial and 0.2 mm axial glue clearance. **FITS.**

Caveats:

- The bill line "10x magnets + bearing" does **not** identify a size. Confirm the batch in hand is
  the same 8 x 1 discs that were measured in v6.1, not a different order.
- Quantity: one cell needs **4** (2 per face x ±X faces); one pod needs **2**. So a cell+pod pair
  needs 6, and any second cell needs another 4. 10 covers cell + pod + spares, but not a second cell.
- The pockets open onto the **outer** face, so each magnet sits flush with the outside with 2.8 mm
  of wall behind it. That is the right way round for holding force. A 1 mm-thick 8 mm disc is still
  a weak magnet — two per face is not much dock retention, so expect the chain to be light-duty.
- The "bearing" on the bill is **no longer needed** — v7.1 replaced the bearing-ball braille dot
  with a printed 1.5 mm dome (`docs/SOURCING.md` §3).
- **Separate gap:** the **cam homing magnet (3 x 2 mm)** is a different part and is **not in hand**.
  See §2c — and note its pocket is currently broken.

---

## 9. DOT INSERT INTO TOP PLATE — FITS (verified numerically)

**[SCAD]** From `mech_layout.scad` / `dot_insert.scad` / `top_plate.scad`:

| feature | insert | plate pocket | clearance |
|---|---|---|---|
| body (square) | `insert_body` = 11.0 | `insert_body + insert_fit` = **11.2** | 0.1 mm/side |
| flange (square) | `insert_flange` = 15.0 | `insert_flange + insert_fit` = **15.2** | 0.1 mm/side |
| body height | `insert_h − insert_flange_h` = 2.0 | opening runs full 4 mm thickness | ok |
| flange height | `insert_flange_h` = 1.2 | rebate from z=2.0 to 3.2 = **1.2** | exact |
| total height | `insert_h` = 3.2 | `plate_thickness − finger_pad_depth` = 4.0 − 0.8 = **3.2** | **flush** |

- **Glue shelf:** rebate floor at z = 2.0, ring width (15.2 − 11.2)/2 = **2.0 mm** all round,
  area = 15.2² − 11.2² = **105.6 mm²**. Matches the documented ~106 mm².
- **Spring recess ceiling:** `spring_bores` cut z = −0.01 .. 2.0, i.e. exactly the body height, so
  the ceiling is the flange underside at insert-z 2.0 = linkage-y 11.0. This matches the
  `mech_layout.scad` comment "dot DOWN 8.0 → 11.0 = 3.0 mm". **Consistent.**
- **Dot clearance:** `plate_hole_dia` 1.7 vs `dot_dome_dia` 1.5 → 0.1 mm/side. Correct.
- **Feature envelope:** dots span x = ±2.4, y = ±2.6; plus the Ø2.2 spring bore radius that is
  x = ±3.5, y = ±3.7 — comfortably inside the 11 mm body.

**Verdict: FITS.** The only real risk is manufacturing, not geometry:

1. The plate is PETG on a 0.4 mm nozzle. A square 11.2 mm hole prints undersize and picks up
   elephant's foot on the first layers. Expect to **file the opening** or add a 0.15-0.2 mm chamfer.
2. 0.1 mm/side is a *press* fit, not a *glue* fit. Thin CA will wick in; epoxy will not — it needs
   ~0.15-0.2 mm. Use thin CA on the shelf, per the assembly note in `dot_insert.scad`.
3. Wipe squeeze-out off the top face before it cures or the domes jam. Already documented.

---

## 10. MEASUREMENTS REQUIRED BEFORE ASSEMBLY

Every one of these must be taken with calipers on **the actual part in hand**, not from a datasheet
or a product listing. The right-hand column is the CAD symbol it feeds.

### Motor — 28BYJ-48 (blocks base_plate, mid_plate, braille_cam, outer_box)

| # | Measure | Feeds |
|---|---|---|
| 1 | Can outer diameter | `motor_body_diameter` (base_plate); collar ID 29.5 (mid_plate) |
| 2 | Can height, bottom face to bracket face | `base_plate_z` = 41 (outer_box) |
| 3 | Shaft centre → can centre distance | `motor_body_x_offset` = −8; `motor_x_offset` = −8 |
| 4 | Shaft diameter | cam bore cylinder Ø5.2 (`r=2.6`, braille_cam) |
| 5 | Shaft flat-to-flat width | cam bore clip `cube([10, 3.2, ...])` |
| 6 | Shaft length above the bracket face | `hub_h` = 4, `shaft_bore_depth` = 8, and the whole z-stack |
| 7 | Shaft boss (raised collar) diameter and height | cam hub OD Ø9 (`r=4.5`) |
| 8 | Mount-hole centre-to-centre | `motor_mount_spacing` = 35 |
| 9 | Mount-hole diameter | `motor_mount_hole` = 4.3 |
| 10 | Bracket ear outer width / thickness | `base_length` = 56 (the 0.35 mm edge wall problem) |

### Hall sensor (blocks base_plate)

| # | Measure | Feeds |
|---|---|---|
| 11 | MH-Sensor module PCB length x width x thickness | `hall_pocket_w` = 5.3, `hall_pocket_d` = 4.3 — **or** the decision to desolder |
| 12 | Header height above the PCB (or below, if it must lie flat) | `hall_pocket_h` = 3 |
| 13 | If desoldering: bare TO-92 body width x depth x height, and lead pitch | `hall_pocket_w/d/h`, `hall_wire_w/d` |

### Inline pigtail cable exit (blocks final esp32_pod_lid release)

| # | Check | Feeds |
|---|---|---|
| 14 | Smallest 5x3 / 6x4 / 7x5 coupon opening that passes both insulated leads without damage | `power_cable_slot_w/h` |
| 15 | Tie-post pull test after the cable is secured | strain-relief acceptance; no geometry change unless the post fails |
| 16 | Polarity | already measured 2026-08-01: red is centre-positive; re-test only after connector/adapter replacement |

### ESP32 DevKit (blocks esp32_pod_shell, esp32_pod_params)

| # | Measure | Feeds |
|---|---|---|
| 20 | Board length | `devkit_length` = 51.5 |
| 21 | Board width | `devkit_width` = 28.0 |
| 22 | Pin-row centre-to-centre pitch | **M21 measured 25.6mm; `hdr_row_pitch` updated** |
| 23 | Pin count per row | `hdr_strip_len` = 40 |
| 24 | USB socket: width, height, and height of its underside above the board | `usb_w` = 10, `usb_h` = 7, `usb_z` = 12.5 |
| 25 | Your USB cable's overmould width x height | `usb_w`, `usb_h` |
| 26 | Female header strip: body width and height with a board seated | `hdr_strip_w` = 2.7, `hdr_strip_h` = 8.5 |

### ULN2003 driver module (blocks outer_box, mid_plate)

| # | Measure | Feeds |
|---|---|---|
| 27 | Board length x width | elec pocket 36 x 46 (outer_box) |
| 28 | Total height **with wires soldered flat** | `elec_pocket_h` = 16 |
| 29 | Height and position of the tallest connector | mid_plate relief slot `[3,−23] cube([17,8])` |
| 30 | Mounting-hole positions, if you intend to bolt it | `mb_boss_positions` = (±14, ±19) |

### Magnets and switches

| # | Measure | Feeds |
|---|---|---|
| 31 | Docking magnet diameter x thickness (re-confirm the new batch) | `mag_dia` = 8.4, `mag_depth` = 1.2 |
| 32 | Homing magnet diameter x thickness (**must be bought — 3x2 mm**) | `magnet_dia` = 3.0, `magnet_depth` = 2.0 |
| 33 | Tactile switch body W x D, total height including plunger, plunger travel | `sw_body` = 6.4, `sw_depth` = 5.5, cage depth 7.2, `nav_shaft_len` = 4.5 |
| 34 | Switch lead spread and lead orientation | switch cage fin spacing |

### Pogo pins (not audited here — no dimensions exist in the CAD at all)

| # | Measure | Feeds |
|---|---|---|
| 35 | Pogo carrier board width x height x thickness | `pogo_carrier_w` = 12, `pogo_carrier_h` = 10, `pogo_carrier_d` = 2 — all explicitly marked "measure real part!" |
| 36 | Pogo pin free length and compressed length | pogo slot `cube([6,10,8])`, `pogo_pad_recess` = 1 |

---

## 11. BOTTOM LINE

**Do not order resin yet, and do not attempt a full assembly.**

Blocking failures that are certain from the source, independent of any measurement:

1. The hall sensor pocket **does not exist** — it is entirely inside the cam pocket at the same depth (§2a).
2. The cam homing-magnet pocket is a **through-hole that craters cam tracks 2 and 3** (§2c).
3. The motor's **right mounting screw hole opens into the spring cavity** — one-screw motor (§3a).
4. The motor's **left screw hole has a 0.35 mm wall** to the plate edge (§3b).
5. The **ESP32 board overruns the pod cavity by 1.75 mm** (§6a).
6. The **USB cutout is ~2 mm above the port** (§6c).
7. The **jack cradle overruns the pod cavity by 1.5 mm**, with placeholder dimensions (§7a).
8. The **cam z-stack does not close**: hub 2 mm too long, shaft ~6 mm too long for the open bore,
   putting all six dots permanently proud and the shaft into the dot-cluster risers (§4c).

What actually passes: the **dot insert / top plate** interface (§9), the **docking magnets** (§8),
and the **ULN2003 in the pocket provided its wires are soldered flat** (§5).

The single highest-value next action remains the one in the handoff: **take the 36 measurements
above**, starting with the motor, then re-derive the z-stack in one pass. Nothing downstream is
trustworthy until the motor is a measured object rather than a datasheet.

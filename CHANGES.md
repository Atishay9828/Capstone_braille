# Braillix CAD — Change Log & Engineering Report
**Date:** 2026-05-02  
**Session authors:** Mridul (hardware lead), Atishay (hardware engineer)  
**AI-assisted review & implementation**

---

## Overview

All five original OpenSCAD render files were audited before any physical prototyping. Four critical dimensional bugs were found that would have caused assembly failure on the first print. All were fixed. One new file was created (linkage set). A Blender presentation render was set up.

Nothing has been physically printed yet — all fixes are pre-print.

---

## File Status Summary

| File | Status | Nature of change |
|---|---|---|
| `base_plate.scad` | **Modified** | Bug fixes + new Hall sensor pocket |
| `top_plate.scad` | **Redesigned** | Full rewrite — wrong size, wrong holes, wrong slots |
| `braille_cam2.scad` | **Modified** | Added magnet homing pocket |
| `braille_cam.scad` | **Deprecated** | Comment added, file kept as archive |
| `outer box.scad` | **Modified** | Added pogo pin connector slots |
| `linkage.scad` | **NEW** | Created from scratch — 6 laser-cut metal cranks |
| `braillix_assembly.blend` | **NEW** | Blender exploded-view scene |
| `assembly_preview_eevee.png` | **NEW** | EEVEE preview render |

---

## 1. `base_plate.scad` — Bug Fixes + Hall Sensor

### Bug 1 — Cam pocket too small (would have jammed on assembly)

**Original:**
```openscad
cam_pocket_diameter = 35;
```

**Fixed:**
```openscad
cam_pocket_diameter = 37; // 36.4mm cam OD + 0.3mm clearance each side
```

**Why:** The cam disc outer radius is `inner_radius + dots × (track_width + track_gap)` = `8 + 6×(1.6+0.1)` = `18.2mm` → **OD = 36.4mm**. A 35mm pocket is 1.4mm too small. The cam disc cannot be inserted. Fixed to 37mm (0.3mm clearance per side).

---

### Bug 2 — Duplicate `ribs()` call (geometry corruption)

**Original assembly block:**
```openscad
union() {
    difference() { ... }
    standoffs();
    intersection() {
        translate([0,0,-rib_height]) main_body();
        ribs();
    }
    translate([0,0,0]) ribs();  // ← DUPLICATE bare call, unconstrained
}
```

**Fixed:**
```openscad
union() {
    difference() { ... }
    standoffs();
    intersection() {
        translate([0,0,-rib_height]) main_body();
        ribs();
    }
    // Bare ribs() call removed
}
```

**Why:** Calling `ribs()` outside the `intersection()` added floating rib geometry extending beyond the plate boundary. The `intersection()` correctly clips ribs to the plate footprint. The bare call created duplicate overlapping geometry — bad for STL export and slicer.

---

### Addition — Hall effect sensor pocket

**Added parameters:**
```openscad
hall_pocket_x = 19;   // Just outside cam track area (cam radius 18.2mm + 0.8mm)
hall_pocket_y = 0;
hall_pocket_w = 5;    // SS49E / A3144 footprint
hall_pocket_d = 4;
hall_pocket_h = 3;    // Leaves 2mm floor under sensor
hall_wire_w   = 2;    // Wire channel width
hall_wire_d   = 1;    // Wire channel depth
```

**Added module:**
```openscad
module hall_sensor_pocket() {
    // Rectangular recess for Hall effect sensor body
    translate([hall_pocket_x - hall_pocket_w/2,
               hall_pocket_y - hall_pocket_d/2,
               base_thickness - hall_pocket_h])
        cube([hall_pocket_w, hall_pocket_d, hall_pocket_h + 1]);
    // Wire channel running to plate edge
    translate([hall_pocket_x + hall_pocket_w/2,
               hall_pocket_y - hall_wire_w/2,
               base_thickness - hall_wire_d])
        cube([base_length/2 - hall_pocket_x - hall_pocket_w/2 + 1,
              hall_wire_w, hall_wire_d + 1]);
}
```

**Why:** The homing system requires a Hall effect sensor (SS49E or A3144) fixed on the base plate at a known angular reference. The magnet on the cam disc passes over it on every rotation. Without this pocket, the sensor would sit proud of the surface and be crushed by the cam disc. The pocket is at x=19mm — 0.8mm outside the outermost track edge (18.2mm) — so the cam disc clears it.

---

## 2. `top_plate.scad` — Full Redesign

The original file had three independent bugs. Since fixing all three required changing almost every module, the file was fully rewritten as **v2.0**.

### Bug 1 — Plate too small to reach standoffs

**Original:**
```openscad
plate_width = 20;
plate_height = 28;
```
The base plate standoffs are at `±15mm` from centre = 30mm grid. A 20×28mm plate cannot physically reach ±15mm in X.

**Fixed:**
```openscad
plate_size = 34.0;  // Square — reaches standoffs at ±15mm with 2mm margin
```

---

### Bug 2 — Mounting holes in wrong pattern

**Original:** 3 holes at 120° on a 12mm radius circle.  
**Base plate:** 4 standoffs at `[±15, ±15]` (a 30×30mm square grid).

These patterns are geometrically incompatible — none of the 3 holes align with any of the 4 standoffs. The top plate could not be bolted down.

**Fixed:**
```openscad
standoff_offset = 15.0;
screw_dia       = 2.8;    // M2.5 clearance
counterbore_dia = 5.0;    // M2.5 button-head counterbore
counterbore_depth = 1.5;

module mounting_holes() {
    for(x = [-1,1]) for(y = [-1,1]) {
        translate([x * standoff_offset, y * standoff_offset, 0]) {
            translate([0, 0, -1]) cylinder(d=screw_dia, h=plate_thickness + 5);
            translate([0, 0, plate_thickness - counterbore_depth])
                cylinder(d=counterbore_dia, h=counterbore_depth + 1);
        }
    }
}
```

4 corner holes at `[±15, ±15]` exactly match the 4 base plate standoffs.

---

### Bug 3 — Round pin bores instead of rectangular linkage slots

**Original:** `cylinder(d=1.75, ...)` — round 1.75mm diameter bores.

**Problem:** The linkages are flat 1mm thick laser-cut metal pieces. A round bore doesn't constrain the linkage from rotating/twisting. The linkage would spin in the hole rather than translate vertically, jamming the pin. Also 1.75mm is too loose for a 1.0mm thick flat piece.

**Fixed:**
```openscad
slot_width  = 1.2;   // 1mm metal + 0.2mm clearance
slot_length = 3.0;   // Allows linkage travel (lift = 0.8mm, margin = 1.1mm each side)

module linkage_slot() {
    translate([-slot_width/2, -slot_length/2, -1])
        cube([slot_width, slot_length, plate_thickness + 5]);
}
```

1.2×3mm rectangular slots oriented along the Y-axis (linkage travel direction). The slot constrains the linkage so it can only translate up/down — no rotation possible.

---

### Additions in v2.0 (beyond bug fixes)

- **Finger pad recess:** 0.8mm shallow recess on top face for tactile boundary
- **Spring pockets:** 3.5mm dia × 1.5mm deep round pockets on underside for return springs (separate from linkage slots — springs are round, slots are rectangular)
- **Thumb ridge:** Small raised ridge on left edge (`sphere(r=0.6)` hull) so a blind user can orient the cell by touch
- **Slot chamfers:** 0.3mm lead-in chamfer on each slot opening to guide linkage insertion during assembly

---

## 3. `braille_cam2.scad` — Magnet Homing Pocket

### Addition — Magnet pocket on disc underside

**Added parameters:**
```openscad
magnet_dia    = 3.0;   // 3mm dia neodymium disc magnet
magnet_depth  = 2.0;   // 2mm deep (magnet sits flush with disc bottom)
magnet_radius = 17.35; // Centre of outermost track — consistent reference
magnet_angle  = 0;     // Defines angular "home" position
```

**Implementation:** The entire cam assembly is wrapped in a `difference()` that subtracts the magnet pocket from the disc underside:

```openscad
difference() {
    union() {
        // solid floor cylinder
        // central D-shaft hub
        // 6 track polyhedra
        // debug markers (preview_mode only)
    }
    // Homing magnet pocket
    translate([magnet_radius * cos(magnet_angle),
               magnet_radius * sin(magnet_angle),
               -1])
        cylinder(d=magnet_dia + 0.2, h=magnet_depth + 1, $fn=30);
}
```

**Why:** The motor has no encoder. On every boot, the ESP32 must find position 0 before accepting Braille commands. The magnet passes the Hall sensor once per revolution — the firmware reads this as the home pulse and sets its step counter to 0. `magnet_radius = 17.35mm` is the centre of track 5 (outermost), chosen to be inside the disc OD (18.2mm) so nothing protrudes.

### Also fixed — `preview_mode` default

Changed `preview_mode = true` → `preview_mode = false` to prevent debug marker cubes from appearing in STL exports by default.

---

## 4. `braille_cam.scad` — Deprecated

**Added at top of file:**
```openscad
// DEPRECATED — use braille_cam2.scad
// This file uses 1.0mm pin lift and a pre-baked polyhedron mesh (not parametric).
// braille_cam2.scad supersedes this with 0.8mm lift, S-curve ramps, D-shaft hub,
// magnet homing pocket, and full parameter control.
```

File retained as archive. Do not export STLs from this file.

---

## 5. `outer box.scad` — Pogo Pin Connector Slots

### Addition — Inter-cell UART connector slots

**Added parameters:**
```openscad
has_right_pogo  = true;       // Set false for last cell in chain (right wall stays solid)
pogo_slot_w     = 10;         // Wide enough for 4-pin 2mm-pitch PCB connector
pogo_slot_h     = 8;          // Height of rectangular window
pogo_slot_depth = wall_thickness + 2;  // Through-wall cutout
pogo_z          = floor_thickness + (shell_height - floor_thickness) / 2;  // Mid-height
```

**Added module:**
```openscad
module pogo_connector_slots() {
    // Left wall — spring pins face out to contact previous cell
    translate([-shell_length/2, 0, pogo_z])
        cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
    // Right wall — contact pad / PCB receiver side (conditional)
    if(has_right_pogo)
        translate([shell_length/2, 0, pogo_z])
            cube([pogo_slot_depth, pogo_slot_w, pogo_slot_h], center=true);
}
```

**Why:** Braillix cells daisy-chain via 4-pin pogo connectors (5V, GND, TX, RX). The spring pins on the left wall of each cell press against the contact pads on the right wall of the previous cell when cells are docked together. The last cell in a chain has no right neighbour — set `has_right_pogo = false` to keep its right wall solid.

---

## 6. `linkage.scad` — New File (Laser-Cut Metal Cranks)

**Created from scratch.** Not 3D-printed — these are laser-cut from 1mm stainless steel or aluminium sheet.

### Purpose

Each linkage is a stair-step flat metal crank that bridges one concentric cam track to its corresponding Braille pin slot. When the cam rotates to a state where track N is in the "up" position, it pushes linkage N upward, which lifts the corresponding pin through the top plate slot.

### Geometry (per linkage)

```
Foot    → 2.0mm wide × 2.5mm long, rounded tip (rides on cam track surface)
Riser   → 1.0mm wide, 9.0mm tall (clears cam disc height + base plate thickness)
Arm     → horizontal bridge from cam track radius to Braille dot X position
Nub     → 1.2mm wide × 2.0mm long × 1.5mm tall (fits top plate slot exactly)
```

All features extruded to 1.0mm thickness (sheet metal gauge).

### Track-to-dot mapping

| Linkage | Track | Track centre radius | Dot | Dot X | Dot Y |
|---|---|---|---|---|---|
| 0 | 0 (innermost) | 8.85mm | dot 1 | −2.4mm | +2.6mm |
| 1 | 1 | 10.55mm | dot 2 | −2.4mm | 0mm |
| 2 | 2 | 12.25mm | dot 3 | −2.4mm | −2.6mm |
| 3 | 3 | 13.95mm | dot 4 | +2.4mm | +2.6mm |
| 4 | 4 | 15.65mm | dot 5 | +2.4mm | 0mm |
| 5 | 5 (outermost) | 17.35mm | dot 6 | +2.4mm | −2.6mm |

### Key parameters

```openscad
foot_w        = 2.0;   // Foot width
riser_h       = 9.0;   // Riser height — clears cam + base plate surface
nub_w         = 1.2;   // Must match top_plate slot_width exactly
nub_h         = 1.5;   // Protrusion above top plate
track_width   = 1.6;   // Must match braille_cam2.scad
inner_radius  = 8.0;   // Must match braille_cam2.scad
col_spacing   = 4.8;   // Must match top_plate.scad
row_spacing   = 2.6;   // Must match top_plate.scad
```

### Export instructions

In OpenSCAD: **File → Export → Export as DXF**. Send the DXF to any laser cutting service. Material: 1mm stainless steel (recommended) or 1mm aluminium. Post-process: sand the foot tips smooth, lubricate with silicone grease.

---

## 7. Blender Assembly Scene

### File
`renders/braillix_assembly.blend`

### Setup
- **Engine:** Cycles, GPU Compute (CUDA — GTX 1650 compatible, no OptiX needed)
- **Samples:** 256 with OIDN denoiser
- **Resolution:** 1920×1080
- **Output:** `renders/assembly_render.png`

### Objects and materials

| Object | Z position (exploded) | Material |
|---|---|---|
| Outer_Box | 0mm | Dark grey PLA |
| Base_Plate | 86mm | Grey PLA |
| Cam_Disc | 149.5mm | Translucent resin (SLA) |
| Linkage_1–6 | 214.5mm | Brushed steel (metallic) |
| Top_Plate | 275.5mm | White PLA |

### Lighting
4× SUN lights (distance-independent — correct for mm-scale scenes):
- Key light: left-front, 45° elevation, 5W
- Fill light: right, 60° elevation, 2W
- Rim light: rear-right, 30° elevation, 3W
- Top light: directly above, 3W

### How to final render
Open `braillix_assembly.blend` in Blender → click the 3D viewport → press **F12**. Render saves automatically to `renders/assembly_render.png`. Takes ~3–5 minutes on GTX 1650. The last ~2 seconds is OIDN denoising on CPU — normal, not a crash.

---

## 8. `outer box.scad` — Navigation Buttons (2026-05-03)

Three 12×12mm momentary tactile switches added to the front face of the enclosure.

### Button layout

```
Front face (y = −shell_width/2):

 [BACK]        [SELECT]    [NEXT]
  x=−24mm       x=+1mm     x=+24mm
  z=10mm        z=10mm     z=10mm
```

**BACK (left):** display previous character  
**SELECT (centre):** confirm MCQ answer / enter  
**NEXT (right):** display next character

### Parameters added

```openscad
btn_hole_dia    = 12.5;   // 12mm switch body + 0.5mm clearance
btn_z           = 10;     // comfortable thumb height from floor
btn_x_back      = -24;    // LEFT
btn_x_next      =  24;    // RIGHT
has_select_btn  = true;
btn_x_select    =  1;     // 1mm off-centre (see note below)
```

### Why x=−24 and x=+1 (not x=−22 and x=0)

OpenSCAD CGAL requires that no two subtracted shapes share an exact coplanar face or edge. The vent slots are 1.5mm wide centred at x = −15, −9.5, −4, +1.5, +7mm — their faces fall at ±0.75mm from each centre. The button hole radius is 6.25mm.

At x=−22: hole right edge = −22+6.25 = **−15.75mm** = vent slot left face at x=−15. Exact match → CGAL non-manifold.  
At x=0: hole right edge = +**6.25mm** = vent slot left face at x=+7. Exact match → CGAL non-manifold.

Moved to x=−24 (right edge −17.75mm, 2mm clear) and x=+1 (right edge +7.25mm, 1mm clear). Both `Simple: yes`, no warnings.

### Switch spec

Standard **12×12mm momentary tactile push switch**, ~₹5/pc. Examples: TS-A2PS-130, TC-1212T, or any generic "12×12 tact switch" from LCSC/Robocraze/Robu. Through-hole mount, 4-pin. Solder leads to ESP32 GPIO + GND.

---

## Known Issues / Pending Decisions

### CRITICAL — ESP32 does not fit inside outer box

The outer box internal cavity (64×54×22mm) has no dedicated space for the ESP32 PCB. After the motor clearance pocket, corner bosses, and base plate seating ledge, there is no contiguous area large enough for any standard ESP32 board.

| Board | Size | Fits? |
|---|---|---|
| ESP32 DevKit V1 | 51×29mm | ❌ No |
| ESP32-WROOM module (bare) | 18×25.5mm | ❌ No (corridors are ~15mm wide) |
| Seeed XIAO ESP32-C3 | 21×17.5mm | ❌ Borderline, no space reserved |
| ESP32-PICO-D4 | 7×7mm | ✓ Possible with custom PCB |

**Options being considered:**
- **A — Extend box:** `shell_length` 78mm → 100mm, adds 22mm bay beside motor for a bare ESP32 module. Minimal redesign.
- **B — External PCB mount:** PCB carrier clips onto outside of left/right wall alongside pogo connectors. Cleaner, more like commercial Braille displays.
- **C — Under-plate thin PCB:** Custom PCB ≤3mm flat on base plate top surface. Requires shaft clearance check.

**Decision needed before printing.**

### Minor — Motor clearance pocket bug in `outer box.scad`

```openscad
translate([0, 0, floor_thickness])
    cylinder(d=motor_clearance_diameter, h=motor_clearance_depth + 1, center=true);
```

`center=true` causes the pocket to extend both 10.5mm below z=4 (only 6.5mm below floor = not enough for 19mm motor body) and 10.5mm above z=4 (removes interior space unnecessarily). Should be a downward-only cut. Not yet fixed — depends on final motor mounting decision once ESP32 placement is resolved.

---

## Dimension Cross-Reference (Critical fits) — UPDATED Rev 2.0

| Interface | Dimension A | Dimension B | Gap |
|---|---|---|---|
| Cam OD in base plate pocket | 36.4mm cam OD | 37mm pocket | 0.3mm per side ✓ |
| Top plate on base standoffs | ±15mm standoffs | ±15mm holes | exact match ✓ |
| Linkage nub in top plate slot | 1.2mm nub | 1.2mm slot | snug (intentional) |
| Linkage foot on cam track | 2.0mm foot | 1.6mm track | foot overhangs 0.2mm each side |
| Magnet in cam pocket | 3.0mm magnet | 3.2mm pocket (dia+0.2) | 0.1mm per side ✓ |
| Hall sensor pocket | SS49E: 4×3×1.5mm | 5×4×3mm pocket | 0.5–1mm clearance ✓ |
| Motor body in motor zone | 28mm body | 40mm zone | 6mm each side ✓ |
| Motor ears in motor zone | 35mm hole spacing | 40mm zone | 2.5mm each side ✓ |
| Base plate in motor zone | 42mm plate | 40mm internal | plate uses full zone ✓ |
| Cam disc clears box midline | disc edge x=−1.8mm | midline x=0mm | 1.8mm ✓ |
| Linkage arm collision gap | 3.0mm stagger | 1.0mm arm + 0.8mm travel | 1.2mm clearance ✓ |

---

## 9. Major Redesign — Two-Zone Layout (2026-05-06)

**Trigger:** Physical inspection of 28BYJ-48 motor confirmed three blocking problems:
1. Motor shaft is **offset from body centre** (gearbox geometry) — cam pocket would be eccentric
2. Motor body is **28mm diameter, 19mm tall** — the original 28mm shell is too short to enclose it (motor would protrude 13.5mm below the floor)
3. Original **standoff height of 3.5mm** was far too short — the linkage stack alone needs 12mm clearance above the base plate

Decision: **shift motor to the left half of a wider box** and use the right half for electronics. This resolves all three problems simultaneously.

### New shell dimensions

| Parameter | Old | New | Reason |
|---|---|---|---|
| `shell_length` | 78mm | **88mm** | Motor zone (40mm) + electronics zone (40mm) + walls |
| `shell_width` | 68mm | 68mm | Unchanged |
| `shell_height` | 28mm | **42mm** | Floor(4) + motor(19) + base plate(5) + standoffs(8) + top plate(3) + margin(3) |
| `internal_length` | 64mm | **80mm** | 88 − 2×4mm walls |
| `motor_x_offset` | 0 (centred) | **−20mm** | Motor centre shifted left; cam disc edge clears midline by 1.8mm |

### Vertical stack (absolute z from box bottom) — verified

```
z = 0    box bottom (sits on desk)
z = 4    floor top  (floor_thickness = 4mm)
z = 4–23 motor body (19mm, hanging from base plate via ear screws)
z = 23   base plate bottom / motor top face (ears screw into plate underside)
z = 28   base plate top  (5mm thick)
z = 25   cam pocket floor (3mm deep from plate top)
z = 27   cam disc flat surface (2mm base resting on pocket floor)
z = 27.8 cam bump tops (0.8mm bump height)
z = 28–36 standoffs (8mm tall — the critical fix)
z = 36   top plate bottom
z = 39   top plate top surface
z = 39.0 nub flush = dot DOWN (inactive)
z = 39.8 nub top   = dot UP   (0.8mm protrusion = active Braille dot)
z = 42   shell top  (2.2mm wall above raised dot)
```

### Two-zone internal layout

```
TOP VIEW (cross-section below base plate, z = 4–23mm):

x = −44 ┌──────────────────┬──────────────────┐ x = +44
        │  MOTOR ZONE      │ ELECTRONICS ZONE │
        │  x=[−40, 0]      │  x=[0, +40]      │
        │                  │                  │
        │  ┌──────────┐    │  ┌─────────────┐ │
        │  │ 28BYJ-48 │    │  │ ULN2003 bd  │ │
        │  │ Ø28mm    │    │  │ 31×35mm     │ │
        │  │ @ x=−20  │    │  │             │ │
        │  └──────────┘    │  │ Pro Mini /  │ │
        │                  │  │ MCP23017    │ │
        │  cam+linkages    │  └─────────────┘ │
        │  above plate     │  (below plate    │
        │                  │   level only)    │
x = −44 └──────────────────┴──────────────────┘ x = +44
```

### Corner boss height correction

Old bosses: 22mm tall (`internal_depth`), starting from floor → base plate at z=26mm (wrong).
New bosses: **19mm tall** (`motor_height`), starting from floor → base plate at z=4+19=**23mm** (correct).
Base plate rests on boss tops AND on motor ears simultaneously for a rigid, located fit.

### Electronics zone PCB mounting posts

Four M2 posts added in the right half (x = +7mm, +33mm; y = ±15mm) at floor level.
Height: 4mm. Accept M2 screws from PCB mounting holes.
Designed to accept:
- ULN2003 driver board (31×35mm) — mounts on all four posts
- Arduino Pro Mini (33×18mm) — mounts on two posts alongside ULN2003

### Button wire slot (left wall)

A 6×4mm slot added to the **left wall** at btn_z height, positioned 14mm toward the back from the front face. Routes 3 signal wires + 1 GND from the front-face panel-mount buttons through to the ESP32 pod clipped on the left wall exterior. Separate from the pogo connector slot (10×8mm) to avoid interference.

---

## 10. `base_plate.scad` — Motor Dimension Corrections (2026-05-06)

All motor interface parameters were wrong. Corrected against physical motor measurements:

| Parameter | Old (wrong) | New (correct) | Effect |
|---|---|---|---|
| `base_length` | 60mm | **42mm** | Plate now spans motor zone only (was too wide for two-zone box) |
| `motor_body_diameter` | 28.3mm | **29mm** | 28mm body + 1mm tolerance |
| `motor_mount_spacing` | 31mm | **35mm** | Actual hole-to-hole distance on motor ears |
| `motor_mount_hole` | 3.4mm | **4.3mm** | 4mm ear holes + 0.3mm clearance (was M3 size — wrong) |
| `shaft_clearance` | 8mm | **7mm** | 5mm shaft + 1mm each side (was over-large) |
| `standoff_height` | 3.5mm | **8mm** | THE CRITICAL FIX — see below |

### Why standoff_height = 8mm (not 3.5mm)

With 3.5mm standoffs: top plate bottom at z=31.5mm. Linkage foot at z=27.8mm (on bump).
Available linkage height = 31.5−27.8 = 3.7mm. Linkage total height = 12mm. **Linkage is 8.3mm too tall — it would crush through the top plate.**

With 8mm standoffs: top plate bottom at z=36mm. Available height = 36−27.8 = 8.2mm for the body below the plate + 3mm plate + protrusion above = correct 12mm total path. ✓

### Hall sensor pocket repositioned

Old position: `x=+19mm, y=0` (along +X axis).
Problem: pocket extends to x=19+2.5=21.5mm, but plate edge is at x=21mm (42mm/2). Pocket overflows plate by 0.5mm → unprintable.

New position: `x=0, y=+20mm` (along +Y axis).
- Plate edge at y=25mm. Pocket extends to y=22.5mm. Clearance = 2.5mm ✓
- Still outside cam OD (18.2mm radius): sensor at r=20mm, gap = 1.8mm ✓
- Wire channel runs from pocket to +Y plate edge (25mm)
- **`magnet_angle` in `braille_cam2.scad` changed from 0° → 90°** to put the home magnet at y=+17.35mm, directly below the new sensor position ✓

---

## 11. `linkage.scad` — Staggered Arms, Corrected Height (2026-05-06)

### Problem 1 — Total height wrong

Old `riser_h = 9.0mm` (total linkage height ~13.5mm from foot to nub top).
Available gap in old design: 3.5mm standoffs + 3mm plate = 6.5mm.
Linkage was **7mm too tall**. It would pierce through the top plate and jam.

New `total_h = 12.0mm` matches the corrected stack exactly:
- Foot on cam flat (z=27mm) → nub top at z=39mm = flush with top plate ✓
- Foot on cam bump (z=27.8mm) → nub top at z=39.8mm = 0.8mm protrusion ✓

### Problem 2 — Arm collision between same-column linkages

All three linkages in a column (e.g. dots 1, 2, 3 at x=−2.4mm) had arms at the same height (`riser_h = 9mm`). When one linkage is pushed up 0.8mm by a cam bump and the adjacent one is at rest, their arms physically overlap.

**Fix: stagger arm heights by 3mm per row:**

| Row | Dots | Arm Y from foot | Lower riser | Upper riser |
|---|---|---|---|---|
| Top | 0, 3 | 3.5mm | 1.0mm | 6.0mm |
| Mid | 1, 4 | 6.5mm | 4.0mm | 3.0mm |
| Bot | 2, 5 | 9.5mm | 7.0mm | 0.0mm |

Collision clearance = stagger(3.0) − arm_h(1.0) − cam_travel(0.8) = **1.2mm** ✓

`arm_h` reduced from 1.5mm → **1.0mm** so the outermost row (arm_y=9.5mm) still fits within total_h=12mm: 9.5 + 1.0 + 0.0 + 1.5 = 12.0mm ✓

---

## 12. `top_plate.scad` — Spring Pockets Removed (2026-05-06)

Spring pockets (3.5mm dia × 1.5mm deep, on plate underside) removed for v1 prototype.

**Reason 1 — Geometry conflict:** The 3.5mm spring pocket and 1.2×3mm linkage slot are co-located at each dot position. The slot cuts entirely through the plate; the pocket cuts 1.5mm from the bottom. Where they intersect, the pocket removes the material that would form the slot walls → degenerate thin walls < 1mm → unprintable and structurally weak.

**Reason 2 — Unnecessary for prototype:** The 1mm stainless steel linkages weigh < 0.1g each. Gravity is sufficient to return them to the down position for desk-use at normal orientations. Springs will be added in v2 once a flange/shoulder feature is added to the linkage design to give the spring a seat.

**Slot chamfers kept:** The 0.3mm lead-in chamfers at each slot entry remain — they guide linkage insertion during assembly.

---

## 13. `braille_cam2.scad` — Magnet Angle Updated (2026-05-06)

```openscad
// Old:
magnet_angle = 0;    // Magnet at +X axis (x=+17.35mm, y=0)

// New:
magnet_angle = 90;   // Magnet at +Y axis (x=0, y=+17.35mm)
```

**Why:** Hall sensor pocket in base_plate.scad was moved from x=+19mm (overflows plate edge) to y=+20mm. The magnet must be at the same angular position as the sensor for homing to work. Setting magnet_angle=90° places the magnet at y=17.35mm, directly below the sensor at y=20mm. Radial gap = 20−17.35 = 2.65mm — within detection range of SS49E/A3144 for a 3mm NdFeB magnet. ✓

---

## 14. Electronics Architecture Decision (2026-05-06)

### Final architecture: Detachable ESP32 "Brain Pod" + Arduino Pro Mini per cell

Each cell contains:
- **Arduino Pro Mini 5V/16MHz** (33×18mm, Rs 120) — receives UART, drives motor, reads hall sensor and buttons
- **ULN2003A bare IC** (SOIC-16 or DIP-16, Rs 10) — replaces the full driver module (28×35mm → 20×7mm)
- **SS49E hall sensor** — homing

Attached to Cell 1 only (or any standalone cell):
- **ESP32 Brain Pod** — external box (~60×40×25mm, 3D-printed) clipping onto the left wall
- Contains: **ESP32 NodeMCU 30-pin** (51×29mm), 5V/3A barrel jack, piezo buzzer
- Connects to cell via pogo slot (UART + power)

### Power distribution

```
5V/3A wall adapter → barrel jack on Brain Pod
  → 5V rail enters Cell 1 via pogo pins (pin 1 = 5V, pin 2 = GND)
  → daisy-chains cell-to-cell through all pogo connectors
  → each cell: 5V → ULN2003 motor power (direct)
               5V → Arduino Pro Mini VCC (5V native, no regulator needed)
               5V → Hall sensor VCC
```

Peak current: 5 motors × 240mA = 1.2A + MCUs/sensors ≈ 1.5A total.
3A adapter provides 2× headroom. 50ms motor stagger in firmware keeps instantaneous draw < 700mA.

### UART protocol (daisy-chain)

```
ESP32 sends: [START][CELL_ID][CAM_ANGLE 0-63][CHECKSUM]\n
Pro Mini: if CELL_ID matches → drive motor to angle, send ACK
          if CELL_ID != mine → decrement CELL_ID, forward on TX
Button events: Pro Mini sends [BTN][MY_ID][BTN_CODE] upstream to master
```

### Hardware notes for assembly

| Item | Spec | Source | Unit cost |
|---|---|---|---|
| 28BYJ-48 stepper motor | 5V DC, 4-phase, Ø28mm×19mm body, 35mm ear spacing, 4mm holes, 5mm D-shaft | Robocraze / local | Rs 80 |
| ULN2003 driver board | 28×35mm module (use for prototype; replace with bare IC in v2) | Robocraze | Rs 40 |
| Arduino Pro Mini 5V | 33×18mm, ATmega328P, 5V/16MHz, 14 digital + 6 analog pins | AliExpress / Robocraze | Rs 120 |
| ESP32 NodeMCU 30-pin | 51×29mm, CP2102 USB-UART, WiFi+BT | Robocraze | Rs 350 |
| SS49E Hall sensor | Linear, 3-pin, 3–6V, SIP-3 package | LCSC / Robocraze | Rs 25 |
| Panel-mount pushbutton | 12mm momentary, threaded barrel, fits 12.5mm hole | Robocraze | Rs 25 |
| Pogo connector set | 4-pin spring-loaded + pad, 2mm pitch | LCSC | Rs 40/pair |
| 5V/3A wall adapter | 5.5×2.1mm barrel, regulated | Local electronics | Rs 200 |
| NdFeB magnet | 3mm dia × 2mm disc | Local / AliExpress | Rs 5 |
| Return springs (optional v2) | OD 3.5mm, ~6mm free length, compression | Local hardware | Rs 5 each |

### GPIO pin assignments (Arduino Pro Mini per cell)

| Pin | Function |
|---|---|
| D2 | ULN2003 IN1 (motor coil A) |
| D3 | ULN2003 IN2 (motor coil B) |
| D4 | ULN2003 IN3 (motor coil C) |
| D5 | ULN2003 IN4 (motor coil D) |
| A0 | Hall sensor signal (analog read) |
| D8 | BACK button (INPUT_PULLUP, active LOW) |
| D9 | SELECT button (INPUT_PULLUP, active LOW) |
| D10 | NEXT button (INPUT_PULLUP, active LOW) |
| D0/RX | UART receive (from upstream cell or ESP32 pod) |
| D1/TX | UART transmit (to downstream cell) |

**Note:** D0/D1 are hardware UART pins — do NOT use Serial.print() for debug on these pins during normal operation. Use SoftwareSerial on spare pins for debug output during development.

---

## Updated Dimension Cross-Reference (Rev 2.0)

| Interface | Dim A | Dim B | Gap | Status |
|---|---|---|---|---|
| Cam OD in base plate pocket | 36.4mm | 37mm pocket | 0.3mm/side | ✓ |
| Top plate on standoffs | ±15mm standoffs | ±15mm holes | exact | ✓ |
| Linkage nub in slot | 1.2mm nub | 1.2mm slot | snug | ✓ |
| Linkage arm collision gap | 3mm stagger | 1mm arm + 0.8mm travel | 1.2mm | ✓ |
| Linkage total height | 12mm | 39−27=12mm available | exact | ✓ |
| Motor body in zone | Ø28mm | 40mm zone | 6mm/side | ✓ |
| Motor ears in zone | 35mm span | 40mm zone | 2.5mm/side | ✓ |
| Hall sensor vs plate edge | 22.5mm pocket edge | 25mm plate edge | 2.5mm | ✓ |
| Hall sensor vs cam OD | r=20mm sensor | r=18.2mm cam OD | 1.8mm | ✓ |
| Magnet to sensor radial gap | r=17.35mm magnet | r=20mm sensor | 2.65mm | ✓ detectable |
| ULN2003 board in elec zone | 31mm board | 40mm zone | 4.5mm/side | ✓ |

---

## Section 15 — Outer Box v3.0: Motor Centred + Electronics Sub-Floor

**Date:** 2026-05-06  
**Files changed:** `outer_box.scad` (v2.0→v3.0), `base_plate.scad` (v2.0→v2.1)  
**STL verified:** `Simple: yes` for both

### Problem: motor shaft was offset from box centre

In v2.0 the motor was placed at `motor_x_offset = −20mm` (left zone).  
This is **wrong** — the cam disc must be centred over the braille dot array, which must be centred in the box. An off-centre cam means the linkages and top-plate slots are offset from any symmetric reference, making the cell asymmetric and the array invisible from the user's expected finger position.

**Fix:** `motor_x_offset = 0` → shaft and cam disc centred in box.

### Consequence: two-zone side layout abandoned

With motor centred, there is no clear "right zone" for a 31×35mm ULN2003 board beside the 28mm motor (only 13mm clearance each side). Electronics must go elsewhere.

**Solution:** Electronics pocket below motor body.

The motor body hangs 19mm below the base plate. By raising `base_plate_z` from 23mm to 32mm (adding 9mm of sub-floor space), the area directly below the motor becomes a routed pocket that fits both the Arduino Pro Mini (33×18mm) and the ULN2003 board (31×35mm) lying flat.

### New stack (z from outer box bottom)

| z (mm) | Component |
|--------|-----------|
| 0      | Outer box bottom |
| 4      | Inner floor top |
| 4–13   | **Electronics sub-pocket** (9 mm, fits Pro Mini + ULN2003) |
| 13     | Motor body bottom |
| 32     | Motor ears / base plate bottom |
| 37     | Base plate top |
| 34     | Cam disc bottom (3 mm deep pocket from plate top) |
| 36     | Cam disc flat surface |
| 36.8   | Cam disc bump top (0.8 mm lift) |
| 45     | Standoffs top / top plate bottom |
| 48     | Top plate top surface |
| 48     | Linkage nub top when dot DOWN (flush) ✓ |
| 48.8   | Linkage nub top when dot UP (0.8 mm proud) ✓ |
| 50     | Outer box top (1.2 mm clearance above nubs) ✓ |

### Parameter changes summary

| Parameter | v2.0 | v3.0 | Reason |
|-----------|------|------|--------|
| `motor_x_offset` | −20 mm | 0 mm | Centre shaft in box |
| `shell_length` | 88 mm | 60 mm | No side electronics zone needed |
| `shell_height` | 42 mm | 50 mm | 9 mm sub-floor for electronics |
| `base_plate_z` | 23 mm | 32 mm | = floor(4) + elec(9) + motor(19) |
| `boss_height` | 19 mm | 28 mm | = base_plate_z − floor_thickness |
| `elec_pocket_w/d` | — | 36×46 mm | New: sub-floor PCB pocket |
| `btn_x_back/next` | ±24 mm | ±20 mm | Symmetric about new centre |
| `btn_x_select` | 1 mm (vent-clear) | 0 mm | True centre |
| `internal_length` | 80 mm | 52 mm | Matches narrower shell |

### base_plate.scad v2.1

- `base_length` widened from 42 mm → 50 mm (symmetrically centred at x=0)
- 50 mm plate + 1 mm clearance each side in 52 mm internal cavity ✓
- All other dimensions unchanged

### Blender scene rebuild (2026-05-06)

Scene completely rebuilt from scratch (clean slate):
- **Two collections:** `Final_Assembly` (compact, x=0) and `Exploded_Assembly` (x=+120mm, Z-stretched)
- **Flat shading** applied to all 58 mesh objects (matches FDM printed surface appearance)
- **Exploded Z positions:** box=0, electronics=70, motor=120, baseplate=160, cam=210, linkages=250, topplate=310
- **Linkages shown in 3D assembly position** in both views: foot on cam track (at track_r), nub at dot (x,y), all 6 staggered arm heights correct
- **Hardware represented:** Motor body+shaft+ears, ULN2003 (green PCB), Arduino Pro Mini (green PCB), Hall sensor, homing magnet

### Note on springs

Return springs for braille dots were **intentionally removed for v1 prototype** (`top_plate.scad` v2.1 changelog). Gravity return is sufficient for desk-use (pins just fall when cam moves to low position). Spring pockets would create degenerate thin walls where 3.5mm pocket meets 1.2mm slot. Springs are listed in BOM as "optional v2" at Rs 5 each. Add in v2 once linkage flange geometry is finalized.

---

## Updated Dimension Cross-Reference (Rev 3.0)

| Interface | Dim A | Dim B | Gap | Status |
|---|---|---|---|---|
| Shell around cam disc | Ø36.4mm cam OD | 52mm internal (±26mm) | 7.6mm/side | ✓ |
| Boss pillars vs standoffs | (±15,±15) bosses | (±15,±15) standoffs | exact match | ✓ |
| Boss pillars vs cam pocket | r=21.2mm pillars | r=18.5mm cam pocket | 2.7mm | ✓ |
| Base plate in shell | 50mm plate | 52mm internal | 1mm/side | ✓ |
| Motor body in elec zone | Ø28mm motor | 52mm internal | 12mm/side | ✓ |
| Sub-pocket width vs motor | 36mm pocket | Ø28mm motor | 4mm/side | ✓ |
| Linkage nub through plate | 1.2mm nub | 1.2mm slot | snug fit | ✓ |
| Linkage total height | 12mm | 48−36=12mm | exact | ✓ |
| Linkage nub proud (dot UP) | 0.8mm | 1.2mm shell margin | 0.4mm | ✓ |
| Hall sensor vs new cam OD | r=20mm sensor | r=18.2mm cam | 1.8mm | ✓ |

---

## Section 16 — Full Audit Redesign (May 6 2026)

**Responding to:** Mechanical Design Audit Report (7 critical failures)
**Scope:** All SCAD files rewritten/created. All V3 features implemented. ESP32 Brain Pod added.

### 16.1 Audit Fixes Applied

| Audit Item | Issue | Fix | File |
|------------|-------|-----|------|
| 2.1 Electronics pocket too shallow | 9mm pocket, ULN2003 needs 12-14mm | `elec_pocket_h` 9 -> 16mm | outer_box v4.0 |
| 2.2 Hanging motor (no torque support) | Motor held only by plastic ears | 2mm mid-plate + motor retaining collar (Ø29.5mm ID, 8mm tall) | outer_box v4.0 |
| 3.1 Uncentered motor shaft (8mm offset) | Body pocket and shaft at same x=0 | Body pocket/ears offset to x=-8mm, shaft stays at x=0 | base_plate v2.2 |
| 3.2 Inadequate top plate coverage | 34x34mm plate in 52x60mm cavity | Plate resized to 52x60mm (flush fit) | top_plate v3.0 |
| 4.1 Linkage phase shift (SHOWSTOPPER) | Radial feet at different cam angles | All 6 feet at Y=0 via inline geometry | linkage v3.0 |
| 4.2 Missing spring pockets | Gravity return insufficient | 3.5mm dia x 3mm spring pockets on plate underside | top_plate v3.0 |
| 4.3 Flat rectangular Braille dots | Sharp tabs, illegible to blind users | 2mm round holes + bearing ball caps | top_plate v3.0, braille_cap v1.0 |

### 16.2 V3 Features Implemented

| Feature | Audit Ref | Implementation |
|---------|-----------|----------------|
| Cam hub inversion | 6.1 | Hub extends below disc underside, top surface clear | braille_cam2 v2 |
| Pogo pin safety recess | 6.2 | Left wall pogo slot 1mm deeper | outer_box v4.0 |
| Pogo end cap | 6.2 | TPU snap-fit cover for last cell | pogo_end_cap v1.0 (NEW) |
| Magnetic snap alignment | 6.3 | 3x Ø3.2mm x 2.1mm NeFeB pockets, dock screws removed | outer_box v4.0 |
| Linkage comb guide | 6.4 | 6-slit guide block, clips on mid-plate | linkage_comb v1.0 (NEW) |
| Bearing ball Braille dots | 6.5 | 2mm SS bearing ball in cup on cap | braille_cap v1.0 (NEW) |
| Wire routing gutters | 6.8 | 4mm x 4mm channels along floor edges | outer_box v4.0 |

### 16.3 New Files Created

| File | Purpose |
|------|---------|
| `cad/scad/esp32_pod.scad` | ESP32 NodeMCU 30-pin enclosure (74x38x58mm), barrel jack, USB, pogo interface, magnet snap |
| `cad/scad/braille_cap.scad` | Bearing ball dot caps (1.9mm pin, 3.5mm body, 2mm SS ball cup) |
| `cad/scad/linkage_comb.scad` | PETG guide block with 6 vertical slits (1.25mm wide) |
| `cad/scad/pogo_end_cap.scad` | TPU snap-fit cover for exposed spring pogo pins |

### 16.4 Revised Stack Table (v4.0)

| z (mm) | Component |
|--------|-----------|
| 0 | Outer box bottom |
| 4 | Inner floor top |
| 4-20 | Electronics pocket (16mm) |
| 20-22 | 2mm mid-plate (seals electronics) |
| 22-30 | Motor retaining collar (8mm, at x=-8) |
| 22-41 | Motor body (19mm) |
| 41 | Motor ears / base plate bottom |
| 46 | Base plate top (5mm plate) |
| 43-45 | Cam disc (in 3mm pocket) |
| 45.8 | Cam bump top (0.8mm lift) |
| 54 | Top plate bottom (8mm standoffs from z=46) |
| 57 | Top plate top (4mm plate) = box top |
| 57.8 | Braille dot UP (0.8mm proud) |

### 16.5 Linkage Phase-Shift Fix (Critical)

**Problem:** v2.0 rotated each linkage by `atan2(dot_y, dot_x)` placing feet at
different cam angles. At 5.625deg/character, output was completely scrambled.

**Fix:** All 6 feet land at Y=0 on cam via:
- `arm_span(d) = sqrt((track_r(d) - dot_x(d))^2 + dot_y(d)^2)`
- `asm_ang(d) = atan2(-dot_y(d), track_r(d) - dot_x(d))`

Arm heights re-staggered (dot 1: 4.0mm, dot 4: 7.8mm) giving 2.0mm worst-case
clearance with cam bump. No collision risk.

### 16.6 ESP32 Pod Specifications

- Shell: 74 x 38 x 58mm (L x W x H)
- PCB: ESP32 NodeMCU 30-pin (51x29mm) on M2 bosses
- Power: 11mm barrel jack on top face
- Programming: micro-USB cutout on left face
- Docking: slot + 3x magnet pockets on right face (matches cell tongue)
- Pogo: 10x8mm pad recess at z=30.5mm (aligns with cell pogo_z)
- Antenna: 1.5mm thin wall + grille slots on right end

### 16.7 STL Export Verification

All 9 STLs exported via OpenSCAD CLI — **all manifold (Simple: yes)**:

| File | Size | Simple |
|------|------|--------|
| braille_cam2.stl | 1334 KB | yes |
| outer_box.stl | 1267 KB | yes |
| base_plate.stl | 611 KB | yes |
| linkage.stl | 160 KB | yes |
| top_plate.stl | 1188 KB | yes |
| braille_cap.stl | 2659 KB | yes |
| esp32_pod.stl | 453 KB | yes |
| linkage_comb.stl | 37 KB | yes |
| pogo_end_cap.stl | 29 KB | yes |

### 16.8 Blender Scene Updated

`renders/braillix_assembly.blend` rebuilt with all 9 new STLs:
- **Final_Assembly** collection: all parts at correct v4.0 stack positions
- **Exploded_Assembly** collection: Z-separated for clear component visibility
- ESP32 pod positioned beside cell (x=-71mm)
- All meshes: Shade Flat, material colors assigned
- 9 materials: Shell grey, Plate dark metal, Cam blue, Linkage steel, Top cream, Cap white, Pod dark grey, Comb PETG green, EndCap TPU

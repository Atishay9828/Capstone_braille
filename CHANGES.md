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

## Dimension Cross-Reference (Critical fits)

| Interface | Dimension A | Dimension B | Gap |
|---|---|---|---|
| Cam OD in base plate pocket | 36.4mm cam OD | 37mm pocket | 0.3mm per side ✓ |
| Top plate on base standoffs | ±15mm standoffs | ±15mm holes | exact match ✓ |
| Linkage nub in top plate slot | 1.2mm nub | 1.2mm slot | snug (intentional) |
| Linkage foot on cam track | 2.0mm foot | 1.6mm track | foot overhangs 0.2mm each side |
| Magnet in cam pocket | 3.0mm magnet | 3.2mm pocket (dia+0.2) | 0.1mm per side ✓ |
| Hall sensor pocket | SS49E: 4×3×1.5mm | 5×4×3mm pocket | 0.5–1mm clearance ✓ |

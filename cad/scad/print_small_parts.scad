// =========================================================
// PRINT LAYOUT: ALL SMALL PRINTABLE PARTS — One Build Plate
// Updated 2026-05-15 (Audit 2)
//
// Parts included (4 bodies total):
//   Row 1 — Cam disc (Ø37mm)              ← PETG
//   Row 2 — 3× Nav caps (◁ ○ ▷)          ← PETG
//
// REMOVED (Audit 2, 2026-05-15):
//   Braille dot caps — DEPRECATED. Bearing balls now glued directly
//   onto laser-cut metal linkage nub tips (ball-on-nub approach).
//   See linkage.scad for details.
//
// NOT included (too large or different process):
//   Top plate   → top_plate.scad (RESIN print — tight hole tolerances)
//   Linkages    → laser-cut 1mm stainless steel (linkage.scad → DXF)
//   Pod shell   → esp32_pod_shell.scad  (separate PETG print)
//   Pod lid     → esp32_pod_lid.scad    (separate PETG print)
//   Outer box   → outer_box.scad        (separate PETG print)
//
// REMOVED (v6.0, 2026-06-04): linkage_comb — SCRAPPED. Linkages are constrained at BOTH ends
//   (foot rides the cam track, nub is guided by the 2.5mm top-plate hole), so a separate comb
//   guide is unnecessary. File + STL deleted.
//
// Supports:     NONE required for any part
// Bed footprint: ~50 mm × 70 mm
//
// Print orientations:
//   Cam disc     — hub DOWN on plate, cam tracks UP  (lifted +2mm in module)
//   Nav caps     — shaft DOWN on plate, dome + raised symbol UP
// =========================================================

include <esp32_pod_params.scad>  // nav_shaft_len for cap build-plane placement
use <nav_cap.scad>       // nav_cap_prev(), nav_cap_select(), nav_cap_next()
use <braille_cam.scad>  // braille_cam()

$fn = 60;

// -------------------------------------------------------
// ROW 1 — Cam disc  (centred at origin)
// Ø≈37mm × 4.8mm tall (hub 2mm + disc+tracks 2.8mm)
// -------------------------------------------------------
translate([0, 0, 0])
    braille_cam();

// -------------------------------------------------------
// ROW 2 — Nav caps  (y = -40, clear of cam disc edge at y≈-18.5)
// Each cap: Ø8mm base × 6.2mm tall, 12mm pitch
// -------------------------------------------------------
translate([0, -40, 0]) {
    translate([-12, 0, nav_shaft_len]) nav_cap_prev();
    translate([  0, 0, nav_shaft_len]) nav_cap_select();
    translate([ 12, 0, nav_shaft_len]) nav_cap_next();
}

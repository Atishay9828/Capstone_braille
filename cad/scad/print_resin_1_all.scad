// =========================================================
// RESIN PRINT PLATE 1 of 3 — CAM + LINKAGES + DOT INSERT + NAV BUTTONS
// v7.2 — 2026-07-29
//
// The full resin batch: one complete braille cell mechanism plus the
// three nav button caps for the ESP32 brain pod. Pair with an FDM top_plate.
//
// v7.2: the 68x70mm TOP PLATE is no longer a resin part. It is now an
// ordinary PETG/FDM print (cad/stl/top_plate.stl); only the small
// dot_insert tile still needs resin, and it glues into a pocket in that
// plate. This cut the resin volume by roughly 4x.
//
// Material: TOUGH or ABS-like resin (NOT standard brittle resin — the
// linkages are 1mm sections under repeated spring load).
// Needs separately: 6x 2mm-OD micro compression springs (see SOURCING.md).
// =========================================================

// nav_shaft_len lives in esp32_pod_params.scad. 'use' imports MODULES ONLY,
// never variables, so nav_cap.scad alone leaves it undef and the caps silently
// vanish from the plate. Must be include, not use.
include <esp32_pod_params.scad>
use <braille_cam.scad>   // braille_cam()
use <linkage.scad>       // linkage_3d_v4(dot)
use <dot_insert.scad>    // dot_insert()
use <nav_cap.scad>       // nav_cap_prev() / _select() / _next()

$fn = 60;

// TWO FULL SETS (12). All eight linkages together were only 4% of this
// plate — the cam disc is 94% of it — so a whole second set costs only ~2% more
// and covers snapping a 1mm-thin part during assembly, or building a second
// cell later. Laid out 3 columns x 4 rows by the loop below.
linkage_dots = [1, 2, 3, 4, 5, 6,
                1, 2, 3, 4, 5, 6];
col_pitch = 22;   // widest linkage ~19.7mm across -> ~2.3mm gap
row_pitch = 14;   // linkage 13mm tall -> 1mm gap
grid_x0   = 27;   // clears the cam's 22.2mm outer radius
grid_y0   = -22;

// --- CAM: centred at origin, hub already resting on z=0 ---
braille_cam();

// --- LINKAGES: 3 columns x 4 rows ---
// lifted 0.6mm so the spring flange (which hangs below the body) sits on z=0
for (i = [0 : len(linkage_dots) - 1])
    translate([grid_x0 + floor(i / 4) * col_pitch,
               grid_y0 + (i % 4) * row_pitch,
               0.6])
        linkage_3d_v4(linkage_dots[i]);

// --- DOT INSERT ---
translate([0, -32, 0]) dot_insert();

// --- NAV BUTTON CAPS: rear-facing stem on the plate, dome + symbol upward ---
// nav_cap's flange is at local z=0 and its stem extends to -nav_shaft_len.
// Lift only the caps so their stems share the build plane with the cam/linkages.
translate([14, -32, nav_shaft_len]) nav_cap_prev();
translate([26, -32, nav_shaft_len]) nav_cap_select();
translate([38, -32, nav_shaft_len]) nav_cap_next();
